import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/feedback_service.dart';
import '../services/realtime_client.dart';
import '../services/secure_store.dart';

class AppController extends ChangeNotifier {
  AppController() {
    store = SecureStore();
    api = ApiClient(AppConfig.fromEnvironment, store);
    realtime = RealtimeClient(AppConfig.fromEnvironment, api);
    feedback = FeedbackService();
  }

  late final SecureStore store;
  late final ApiClient api;
  late final RealtimeClient realtime;
  late final FeedbackService feedback;

  bool initialized = false;
  bool onboardingComplete = false;
  bool hasStoredSession = false;
  bool networkUnavailable = false;
  bool hapticsEnabled = true;
  bool soundsEnabled = true;
  bool busy = false;
  String? error;
  UserProfile? user;
  WalletSummary? wallet;
  ThemeMode themeMode = ThemeMode.system;

  bool get signedIn => user != null;

  Future<void> initialize() async {
    if (initialized) return;
    onboardingComplete = await store.onboardingComplete();
    hapticsEnabled = await store.hapticsEnabled();
    soundsEnabled = await store.soundsEnabled();
    feedback.configure(haptics: hapticsEnabled, sounds: soundsEnabled);
    final token = await store.accessToken();
    hasStoredSession = token != null;
    if (token != null) {
      try {
        await refreshDashboard();
      } on ApiException catch (e) {
        if (e.isNetwork) {
          networkUnavailable = true;
          error = e.message;
        } else {
          await store.clearTokens();
          hasStoredSession = false;
          user = null;
          wallet = null;
        }
      } catch (_) {
        await store.clearTokens();
        hasStoredSession = false;
        user = null;
        wallet = null;
      }
    }
    initialized = true;
    notifyListeners();
  }

  Future<void> completeOnboarding() async {
    onboardingComplete = true;
    await store.setOnboardingComplete(true);
    notifyListeners();
  }

  Future<void> retryStoredSession() async {
    if (!hasStoredSession) return;
    await _guard(refreshDashboard);
  }

  Future<void> login(String identifier, String password) async {
    await _guard(() async {
      final result = await api.login(identifier: identifier, password: password);
      user = UserProfile.fromJson((result['user'] as Map).cast<String, dynamic>());
      wallet = WalletSummary.fromJson((result['wallet'] as Map).cast<String, dynamic>());
      hasStoredSession = true;
      _applyTheme(user!.theme);
      await feedback.success();
    });
  }

  Future<void> register({
    String? email,
    required String username,
    required String displayName,
    required String password,
    String? referralCode,
  }) async {
    await _guard(() async {
      final result = await api.register(
        email: email,
        username: username,
        displayName: displayName,
        password: password,
        referralCode: referralCode,
      );
      user = UserProfile.fromJson((result['user'] as Map).cast<String, dynamic>());
      wallet = WalletSummary.fromJson((result['wallet'] as Map).cast<String, dynamic>());
      hasStoredSession = true;
      _applyTheme(user!.theme);
      await feedback.success();
    });
  }

  Future<void> logout() async {
    await _guard(() async {
      await realtime.disconnect();
      await api.logout();
      user = null;
      wallet = null;
      hasStoredSession = false;
      themeMode = ThemeMode.system;
    });
  }

  Future<void> refreshDashboard() async {
    final results = await Future.wait([
      api.get('/users/me'),
      api.get('/wallet'),
    ]);
    user = UserProfile.fromJson(results[0]);
    wallet = WalletSummary.fromJson(results[1]);
    hasStoredSession = true;
    networkUnavailable = false;
    error = null;
    _applyTheme(user!.theme);
    notifyListeners();
  }

  Future<void> updateProfile({String? displayName, String? bio, String? theme}) async {
    await _guard(() async {
      await api.patch('/users/me', body: {
        if (displayName != null) 'displayName': displayName,
        if (bio != null) 'bio': bio,
        if (theme != null) 'theme': theme,
      });
      final fresh = await api.get('/users/me');
      user = UserProfile.fromJson(fresh);
      _applyTheme(user!.theme);
    });
  }

  Future<void> setHapticsEnabled(bool value) async {
    hapticsEnabled = value;
    feedback.configure(haptics: hapticsEnabled, sounds: soundsEnabled);
    await store.setHapticsEnabled(value);
    notifyListeners();
    if (value) await feedback.tap();
  }

  Future<void> setSoundsEnabled(bool value) async {
    soundsEnabled = value;
    feedback.configure(haptics: hapticsEnabled, sounds: soundsEnabled);
    await store.setSoundsEnabled(value);
    notifyListeners();
    if (value) await feedback.tap();
  }

  Future<void> trackEvent(String name, {Map<String,dynamic>? properties}) =>
      api.trackEvent(name, properties: properties);

  void clearError() {
    error = null;
    notifyListeners();
  }

  void _applyTheme(String theme) {
    themeMode = switch (theme) {
      'dark' => ThemeMode.dark,
      'light' => ThemeMode.light,
      _ => ThemeMode.system,
    };
  }

  Future<void> _guard(Future<void> Function() action) async {
    if (busy) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await action();
      networkUnavailable = false;
    } catch (e) {
      error = e is ApiException ? e.message : '$e';
      if (e is ApiException && e.isNetwork) networkUnavailable = true;
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }
}
