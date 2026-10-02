import 'package:flutter/material.dart';

import 'config/app_config.dart';
import 'controller/app_controller.dart';
import 'screens/auth_screen.dart';
import 'screens/home_shell.dart';
import 'screens/onboarding_screen.dart';
import 'widgets/brand_mark.dart';

class YdPlayBootstrap extends StatefulWidget {
  const YdPlayBootstrap({super.key});

  @override
  State<YdPlayBootstrap> createState() => _YdPlayBootstrapState();
}

class _YdPlayBootstrapState extends State<YdPlayBootstrap> {
  late final AppController controller;

  @override
  void initState() {
    super.initState();
    controller = AppController()..addListener(_changed);
    controller.initialize();
  }

  void _changed() => setState(() {});

  @override
  void dispose() {
    controller.removeListener(_changed);
    controller.realtime.dispose();
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'YD Play',
      themeMode: controller.themeMode,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      home: _home(),
    );
  }

  Widget _home() {
    final configIssue = AppConfig.fromEnvironment.runtimeIssue();
    if (configIssue != null) return _ConfigurationError(message: configIssue.message);
    if (!controller.initialized) return const _Splash();
    if (!controller.onboardingComplete) return OnboardingScreen(controller: controller);
    if (controller.signedIn) return HomeShell(controller: controller);
    if (controller.hasStoredSession && controller.networkUnavailable) {
      return _OfflineStartup(controller: controller);
    }
    return AuthScreen(controller: controller);
  }

  ThemeData _theme(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF2FCE78),
      brightness: brightness,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: brightness == Brightness.dark ? const Color(0xFF08110D) : const Color(0xFFF4FAF7),
      cardTheme: CardTheme(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide.none),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
      ),
      navigationBarTheme: const NavigationBarThemeData(height: 72),
    );
  }
}

class _OfflineStartup extends StatelessWidget {
  const _OfflineStartup({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BrandMark(size: 72),
                  const SizedBox(height: 24),
                  const Icon(Icons.cloud_off_rounded, size: 58),
                  const SizedBox(height: 18),
                  Text('YD Play is offline', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 10),
                  const Text('Your saved session is still on this device. Reconnect to the internet or backend and retry—YD Play will not erase your session just because startup networking failed.', textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: controller.busy ? null : () async { try { await controller.retryStoredSession(); } catch (_) {} },
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Retry connection'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            BrandMark(size: 82),
            SizedBox(height: 20),
            Text('YD Play', style: TextStyle(fontSize: 31, fontWeight: FontWeight.w900)),
            SizedBox(height: 8),
            Text('PLAY FAIR • COINS ONLY'),
            SizedBox(height: 24),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}


class _ConfigurationError extends StatelessWidget {
  const _ConfigurationError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BrandMark(size: 72),
                  const SizedBox(height: 24),
                  const Icon(Icons.settings_ethernet_rounded, size: 56),
                  const SizedBox(height: 16),
                  Text('YD Play needs backend setup', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900), textAlign: TextAlign.center),
                  const SizedBox(height: 10),
                  Text(message, textAlign: TextAlign.center),
                  const SizedBox(height: 14),
                  const Text('Rebuild the app with YD_API_URL and YD_WS_URL. Production requires HTTPS and WSS.', textAlign: TextAlign.center),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
