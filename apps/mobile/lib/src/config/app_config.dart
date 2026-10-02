class AppConfigIssue {
  const AppConfigIssue(this.message);
  final String message;
}

class AppConfig {
  const AppConfig({required this.apiBaseUrl, required this.wsUrl});

  final String apiBaseUrl;
  final String wsUrl;

  static const appVersion = '1.0.0';

  static const fromEnvironment = AppConfig(
    apiBaseUrl: String.fromEnvironment(
      'YD_API_URL',
      defaultValue: 'http://10.0.2.2:3000/v1',
    ),
    wsUrl: String.fromEnvironment(
      'YD_WS_URL',
      defaultValue: 'ws://10.0.2.2:3001/ws',
    ),
  );

  AppConfigIssue? runtimeIssue({bool releaseMode = const bool.fromEnvironment('dart.vm.product')}) {
    Uri? api;
    Uri? ws;
    try {
      api = Uri.parse(apiBaseUrl);
      ws = Uri.parse(wsUrl);
    } catch (_) {
      return const AppConfigIssue('The app backend address is invalid.');
    }

    if (!api.hasScheme || api.host.isEmpty || !ws.hasScheme || ws.host.isEmpty) {
      return const AppConfigIssue('YD Play does not have a complete backend configuration.');
    }

    if (releaseMode) {
      final localHosts = {'localhost', '127.0.0.1', '10.0.2.2'};
      if (api.scheme != 'https') {
        return const AppConfigIssue('Release builds require an HTTPS API endpoint.');
      }
      if (ws.scheme != 'wss') {
        return const AppConfigIssue('Release builds require a secure WSS realtime endpoint.');
      }
      if (localHosts.contains(api.host) || localHosts.contains(ws.host)) {
        return const AppConfigIssue('Release builds cannot use localhost or emulator backend addresses.');
      }
    }
    return null;
  }
}
