import 'package:flutter_test/flutter_test.dart';
import 'package:yd_play/src/models/models.dart';
import 'package:yd_play/src/config/app_config.dart';

void main() {
  test('wallet balance parses string values', () {
    final wallet = WalletSummary.fromJson({'balance': '10000'});
    expect(wallet.balance, 10000);
  });

  test('referral summary parses backend shape', () {
    final summary = ReferralSummary.fromJson({
      'code': 'ABC123',
      'invited': {'total': 2, 'rewarded': 1, 'pending': 1, 'review': 0},
      'earnedCoins': '100',
      'program': {'inviterReward': '100', 'inviteeReward': '50'},
    });
    expect(summary.code, 'ABC123');
    expect(summary.total, 2);
    expect(summary.earnedCoins, 100);
  });

  test('mobile version contract is v0.7.0', () {
    expect(AppConfig.appVersion, '0.7.0');
  });
}
