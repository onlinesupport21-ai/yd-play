import 'package:flutter/services.dart';

class FeedbackService {
  bool hapticsEnabled = true;
  bool soundsEnabled = true;

  void configure({required bool haptics, required bool sounds}) {
    hapticsEnabled = haptics;
    soundsEnabled = sounds;
  }

  Future<void> tap() async {
    if (hapticsEnabled) await HapticFeedback.selectionClick();
    if (soundsEnabled) await SystemSound.play(SystemSoundType.click);
  }

  Future<void> round() async {
    if (hapticsEnabled) await HapticFeedback.mediumImpact();
    if (soundsEnabled) await SystemSound.play(SystemSoundType.click);
  }

  Future<void> success() async {
    if (hapticsEnabled) await HapticFeedback.lightImpact();
    if (soundsEnabled) await SystemSound.play(SystemSoundType.click);
  }

  Future<void> warning() async {
    if (hapticsEnabled) await HapticFeedback.heavyImpact();
    if (soundsEnabled) await SystemSound.play(SystemSoundType.alert);
  }
}
