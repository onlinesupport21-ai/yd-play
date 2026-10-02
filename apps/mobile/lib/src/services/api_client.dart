import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'secure_store.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.isNetwork = false});
  final String message;
  final int? statusCode;
  final bool isNetwork;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this.config, this.store, {http.Client? client}) : _client = client ?? http.Client();

  final AppConfig config;
  final SecureStore store;
  final http.Client _client;
  Future<bool>? _refreshInFlight;

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl.substring(0, config.apiBaseUrl.length - 1)
        : config.apiBaseUrl;
    return Uri.parse('$base$path').replace(queryParameters: query);
  }

  Future<Map<String, dynamic>> login({required String identifier, required String password}) async {
    final proof = await store.deviceProof();
    final result = await _sendJson(
      'POST',
      '/auth/login',
      body: {
        'identifier': identifier,
        'password': password,
        'platform': 'android',
        'deviceProof': proof,
        'appVersion': AppConfig.appVersion,
      },
      auth: false,
    );
    await store.saveTokens('${result['accessToken']}', '${result['refreshToken']}');
    return result;
  }

  Future<Map<String, dynamic>> register({
    String? email,
    required String username,
    required String displayName,
    required String password,
    String? referralCode,
  }) async {
    final proof = await store.deviceProof();
    final body = <String, dynamic>{
      'username': username,
      'displayName': displayName,
      'password': password,
      'platform': 'android',
      'deviceProof': proof,
      'appVersion': AppConfig.appVersion,
      'ageGateAccepted': true,
    };
    if (email != null && email.trim().isNotEmpty) body['email'] = email.trim();
    if (referralCode != null && referralCode.trim().isNotEmpty) {
      body['referralCode'] = referralCode.trim().toUpperCase();
    }
    final result = await _sendJson('POST', '/auth/register', body: body, auth: false);
    await store.saveTokens('${result['accessToken']}', '${result['refreshToken']}');
    return result;
  }

  Future<void> logout() async {
    try {
      await _sendJson('POST', '/auth/logout', body: const {});
    } finally {
      await store.clearTokens();
    }
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) =>
      _sendJson('GET', path, query: query);

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) =>
      _sendJson('POST', path, body: body ?? const {});

  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body}) =>
      _sendJson('PATCH', path, body: body ?? const {});

  Future<String?> accessToken() => store.accessToken();

  Future<void> trackEvent(String eventName, {Map<String, dynamic>? properties}) async {
    final id = '${DateTime.now().microsecondsSinceEpoch}-${eventName.hashCode}';
    try {
      await post('/analytics/events', body: {
        'events': [
          {
            'eventId': id,
            'eventName': eventName,
            'occurredAt': DateTime.now().toUtc().toIso8601String(),
            'platform': 'android',
            'appVersion': AppConfig.appVersion,
            'properties': properties ?? const <String, dynamic>{},
          }
        ]
      });
    } catch (_) {
      // Analytics must never block core user flows.
    }
  }

  Future<Map<String, dynamic>> _sendJson(
    String method,
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
    bool auth = true,
    bool retried = false,
  }) async {
    final headers = <String, String>{'accept': 'application/json'};
    if (body != null) headers['content-type'] = 'application/json';
    if (auth) {
      final token = await store.accessToken();
      if (token == null) throw ApiException('Sign in required', statusCode: 401);
      headers['authorization'] = 'Bearer $token';
    }

    final uri = _uri(path, query);
    late http.Response response;
    try {
      if (method == 'GET') {
        response = await _client.get(uri, headers: headers).timeout(const Duration(seconds: 15));
      } else if (method == 'POST') {
        response = await _client
            .post(uri, headers: headers, body: jsonEncode(body ?? const {}))
            .timeout(const Duration(seconds: 15));
      } else if (method == 'PATCH') {
        response = await _client
            .patch(uri, headers: headers, body: jsonEncode(body ?? const {}))
            .timeout(const Duration(seconds: 15));
      } else {
        throw ApiException('Unsupported request method');
      }
    } on TimeoutException {
      throw ApiException('Server timed out. Check your connection and try again.', isNetwork: true);
    } on SocketException {
      throw ApiException('No network connection or server is unreachable.', isNetwork: true);
    } on http.ClientException {
      throw ApiException('Could not reach YD Play services.', isNetwork: true);
    }

    if (response.statusCode == 401 && auth && !retried) {
      final refreshed = await _refreshOnce();
      if (refreshed) {
        return _sendJson(method, path, query: query, body: body, auth: auth, retried: true);
      }
    }

    dynamic decoded;
    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } catch (_) {
        decoded = null;
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map && decoded['message'] != null
          ? (decoded['message'] is List
              ? (decoded['message'] as List).join(', ')
              : '${decoded['message']}')
          : 'Request failed (${response.statusCode})';
      throw ApiException(message, statusCode: response.statusCode);
    }

    if (decoded == null) return <String, dynamic>{};
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return decoded.cast<String, dynamic>();
    return <String, dynamic>{'data': decoded};
  }

  Future<bool> _refreshOnce() async {
    final current = _refreshInFlight;
    if (current != null) return current;

    final future = _performRefresh();
    _refreshInFlight = future;
    try {
      return await future;
    } finally {
      if (identical(_refreshInFlight, future)) _refreshInFlight = null;
    }
  }

  Future<bool> _performRefresh() async {
    final refresh = await store.refreshToken();
    if (refresh == null) return false;
    try {
      final response = await _sendJson(
        'POST',
        '/auth/refresh',
        body: {'refreshToken': refresh},
        auth: false,
        retried: true,
      );
      await store.saveTokens('${response['accessToken']}', '${response['refreshToken']}');
      return true;
    } on ApiException catch (e) {
      if (e.isNetwork) rethrow;
      await store.clearTokens();
      return false;
    } catch (_) {
      await store.clearTokens();
      return false;
    }
  }

}
