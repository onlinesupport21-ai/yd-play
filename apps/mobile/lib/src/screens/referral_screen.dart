import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../controller/app_controller.dart';
import '../models/models.dart';

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  ReferralSummary? summary;
  bool loading = true;
  final applyCode = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { applyCode.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      summary = ReferralSummary.fromJson(await widget.controller.api.get('/referrals/me'));
    } catch (e) {
      _snack('$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _apply() async {
    final code = applyCode.text.trim().toUpperCase();
    if (code.isEmpty) return;
    try {
      await widget.controller.api.post('/referrals/apply', body: {'code': code});
      applyCode.clear();
      await widget.controller.api.post('/referrals/evaluate');
      await _load();
      await widget.controller.refreshDashboard();
      _snack('Referral submitted for server validation.');
    } catch (e) {
      _snack('$e');
    }
  }

  void _snack(String t) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t))); }

  @override
  Widget build(BuildContext context) {
    final s = summary;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Invite friends', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text('Rewards are virtual coins only and are subject to qualification, caps, and anti-abuse checks.'),
            if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
            if (s != null) ...[
              const SizedBox(height: 18),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('YOUR CODE', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Row(children: [
                      Expanded(child: SelectableText(s.code, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: 3))),
                      IconButton(onPressed: () { Clipboard.setData(ClipboardData(text: s.code)); _snack('Referral code copied'); }, icon: const Icon(Icons.copy_rounded)),
                    ]),
                    const SizedBox(height: 10),
                    Text('Inviter reward: ${s.inviterReward} coins • New user reward: ${s.inviteeReward} coins'),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: _Stat(label: 'Invited', value: s.total)),
                const SizedBox(width: 8),
                Expanded(child: _Stat(label: 'Rewarded', value: s.rewarded)),
                const SizedBox(width: 8),
                Expanded(child: _Stat(label: 'Review', value: s.review)),
              ]),
              const SizedBox(height: 12),
              Card(child: ListTile(leading: const Icon(Icons.monetization_on_rounded), title: const Text('Referral coins earned'), trailing: Text('${s.earnedCoins}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20)))),
            ],
            const SizedBox(height: 26),
            Text('Have a referral code?', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            TextField(controller: applyCode, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Enter code')),
            const SizedBox(height: 10),
            FilledButton(onPressed: _apply, child: const Text('Apply code')),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final int value;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12), child: Column(children: [Text('$value', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22)), Text(label)])));
}
