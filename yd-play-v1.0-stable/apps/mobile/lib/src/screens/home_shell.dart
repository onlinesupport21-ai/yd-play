import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import 'home_screen.dart';
import 'profile_screen.dart';
import 'referral_screen.dart';
import 'wallet_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.controller});
  final AppController controller;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(controller: widget.controller),
      WalletScreen(controller: widget.controller),
      ReferralScreen(controller: widget.controller),
      ProfileScreen(controller: widget.controller),
    ];
    return Scaffold(
      body: Column(
        children: [
          if (widget.controller.networkUnavailable)
            SafeArea(
              bottom: false,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                color: Theme.of(context).colorScheme.errorContainer,
                child: Row(
                  children: [
                    Icon(Icons.cloud_off_rounded, color: Theme.of(context).colorScheme.onErrorContainer),
                    const SizedBox(width: 10),
                    Expanded(child: Text('Server unreachable. Existing screen data stays visible; online actions may fail.', style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer))),
                    IconButton(
                      tooltip: 'Retry',
                      onPressed: () async { try { await widget.controller.refreshDashboard(); } catch (_) {} },
                      icon: const Icon(Icons.refresh_rounded),
                    ),
                  ],
                ),
              ),
            ),
          Expanded(child: IndexedStack(index: index, children: pages)),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.grid_view_rounded), label: 'Play'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_rounded), label: 'Coins'),
          NavigationDestination(icon: Icon(Icons.group_add_rounded), label: 'Refer'),
          NavigationDestination(icon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
