import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../config/app_config.dart';
import 'api_client.dart';

class RealtimeClient {
  RealtimeClient(this.config, this.api);

  final AppConfig config;
  final ApiClient api;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  final _events = StreamController<Map<String, dynamic>>.broadcast();
  Timer? _pingTimer;
  bool _closing = false;

  Stream<Map<String, dynamic>> get events => _events.stream;
  bool get connected => _channel != null;

  Future<void> connect() async {
    if (_channel != null) return;
    _closing = false;
    // Protected preflight lets ApiClient rotate an expired access token before WS auth.
    await api.get('/auth/session');
    final token = await api.accessToken();
    if (token == null) throw ApiException('Sign in required');
    final channel = WebSocketChannel.connect(Uri.parse(config.wsUrl));
    _channel = channel;
    await channel.ready;
    _subscription = channel.stream.listen(
      (raw) {
        try {
          final decoded = jsonDecode('$raw');
          if (decoded is Map) _events.add(decoded.cast<String, dynamic>());
        } catch (_) {
          _events.add({'type': 'error', 'code': 'invalid_server_message'});
        }
      },
      onError: (Object error) {
        _events.add({'type': 'socket.closed', 'error': '$error'});
        _disposeSocketOnly();
      },
      onDone: () {
        if (!_closing) _events.add({'type': 'socket.closed'});
        _disposeSocketOnly();
      },
      cancelOnError: false,
    );
    send({'type': 'auth', 'token': token});
    _pingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_channel != null) send({'type': 'ping', 'nonce': '${DateTime.now().millisecondsSinceEpoch}'});
    });
  }

  void send(Map<String, dynamic> message) {
    final channel = _channel;
    if (channel == null) throw StateError('Realtime socket is not connected');
    channel.sink.add(jsonEncode(message));
  }

  Future<void> disconnect() async {
    _closing = true;
    _pingTimer?.cancel();
    _pingTimer = null;
    await _subscription?.cancel();
    _subscription = null;
    await _channel?.sink.close();
    _channel = null;
  }

  void _disposeSocketOnly() {
    _pingTimer?.cancel();
    _pingTimer = null;
    _subscription = null;
    _channel = null;
  }

  Future<void> dispose() async {
    await disconnect();
    await _events.close();
  }
}
