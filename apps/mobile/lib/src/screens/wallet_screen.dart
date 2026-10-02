import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import '../models/models.dart';
import '../widgets/coin_badge.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  List<WalletTransaction> items = const [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { loading = true; error = null; });
    try {
      final data = await widget.controller.api.get('/wallet/transactions');
      final raw = (data['items'] as List?) ?? const [];
      items = raw.whereType<Map>().map((e) => WalletTransaction.fromJson(e.cast<String, dynamic>())).toList();
      await widget.controller.refreshDashboard();
    } catch (e) {
      error = '$e';
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Virtual Coin Wallet', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text('Coins are entertainment points only. They are not transferable, redeemable, or cashable.'),
            const SizedBox(height: 18),
            Align(alignment: Alignment.centerLeft, child: CoinBadge(balance: widget.controller.wallet?.balance ?? 0)),
            const SizedBox(height: 26),
            Row(children: [
              Expanded(child: Text('Recent activity', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
              IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
            ]),
            if (loading) const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
            if (error != null) Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(error!))),
            if (!loading && items.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(18), child: Text('No wallet activity yet.'))),
            ...items.map((tx) => Card(
              child: ListTile(
                leading: CircleAvatar(child: Icon(tx.delta >= 0 ? Icons.add_rounded : Icons.remove_rounded)),
                title: Text(_label(tx.reason), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('${tx.createdAt.toLocal()}\nBalance after: ${tx.balanceAfter}'),
                isThreeLine: true,
                trailing: Text('${tx.delta >= 0 ? '+' : ''}${tx.delta}', style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
            )),
          ],
        ),
      ),
    );
  }

  String _label(String reason) => reason.replaceAll('_', ' ').split(' ').map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
}
