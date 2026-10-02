import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'src/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    if (kDebugMode) {
      debugPrint('Unhandled platform error: $error');
      debugPrintStack(stackTrace: stack);
    }
    return true;
  };

  runZonedGuarded(
    () => runApp(const YdPlayBootstrap()),
    (error, stack) {
      if (kDebugMode) {
        debugPrint('Unhandled zone error: $error');
        debugPrintStack(stackTrace: stack);
      }
    },
  );
}
