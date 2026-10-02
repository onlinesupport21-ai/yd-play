import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStore {
  SecureStore()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );

  final FlutterSecureStorage _storage;

  static const _accessKey = 'yd_access_token';
  static const _refreshKey = 'yd_refresh_token';
  static const _deviceKey = 'yd_device_proof';
  static const _onboardingKey = 'yd_onboarding_v1';
  static const _hapticsKey = 'yd_haptics';
  static const _soundsKey = 'yd_sounds';

  Future<String?> accessToken() => _storage.read(key: _accessKey);
  Future<String?> refreshToken() => _storage.read(key: _refreshKey);

  Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<bool> onboardingComplete() async =>
      (await _storage.read(key: _onboardingKey)) == '1';

  Future<void> setOnboardingComplete(bool value) =>
      _storage.write(key: _onboardingKey, value: value ? '1' : '0');

  Future<bool> hapticsEnabled() => _readBool(_hapticsKey, fallback: true);
  Future<bool> soundsEnabled() => _readBool(_soundsKey, fallback: true);
  Future<void> setHapticsEnabled(bool value) => _storage.write(key: _hapticsKey, value: value ? '1' : '0');
  Future<void> setSoundsEnabled(bool value) => _storage.write(key: _soundsKey, value: value ? '1' : '0');

  Future<bool> _readBool(String key, {required bool fallback}) async {
    final value = await _storage.read(key: key);
    if (value == null) return fallback;
    return value == '1';
  }

  Future<String> deviceProof() async {
    final existing = await _storage.read(key: _deviceKey);
    if (existing != null && existing.length >= 16) return existing;
    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    final proof = base64UrlEncode(bytes).replaceAll('=', '');
    await _storage.write(key: _deviceKey, value: proof);
    return proof;
  }
}
