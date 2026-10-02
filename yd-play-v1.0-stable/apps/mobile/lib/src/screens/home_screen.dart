import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import '../widgets/brand_mark.dart';
import '../widgets/coin_badge.dart';
import 'pulse_grid_screen.dart';
import 'signal_clash_screen.dart';
import 'engagement_screen.dart';
import 'notifications_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final user = controller.user!;
    final balance = controller.wallet?.balance ?? 0;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: controller.refreshDashboard,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
            Row(
              children: [
                const BrandMark(size: 48),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Hi, ${user.displayName}', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                      Text('@${user.username}', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                CoinBadge(balance: balance, compact: true),
              ],
            ),
            const SizedBox(height: 28),
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                gradient: LinearGradient(
                  colors: [
                    Theme.of(context).colorScheme.primaryContainer,
                    Theme.of(context).colorScheme.tertiaryContainer,
                  ],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Play. Improve. Earn virtual coins.', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  const Text('No deposits • No cash-out • No real-money prizes'),
                  const SizedBox(height: 18),
                  CoinBadge(balance: balance),
                ],
              ),
            ),
            const SizedBox(height: 28),
            Text('Games', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            _GameCard(
              icon: Icons.bolt_rounded,
              title: 'Pulse Grid',
              subtitle: '45-second reflex challenge • server-verified score',
              tag: 'SOLO',
              onTap: () async {
                await Navigator.of(context).push(MaterialPageRoute(builder: (_) => PulseGridScreen(controller: controller)));
                await controller.refreshDashboard();
              },
            ),
            const SizedBox(height: 12),
            _GameCard(
              icon: Icons.sports_esports_rounded,
              title: 'Signal Clash',
              subtitle: '2-player realtime lane challenge • public or private room',
              tag: '2P LIVE',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SignalClashScreen(controller: controller))),
            ),
            const SizedBox(height: 22),
            Text('Progress', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _QuickCard(icon: Icons.emoji_events_rounded, title: 'Goals & ranks', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => EngagementScreen(controller: controller))))),
              const SizedBox(width: 10),
              Expanded(child: _QuickCard(icon: Icons.notifications_rounded, title: 'Inbox', onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => NotificationsScreen(controller: controller))))),
            ]),
            const SizedBox(height: 22),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.verified_user_rounded),
                    const SizedBox(width: 12),
                    Expanded(child: Text('Game scores and rewards are validated by the server. The mobile client cannot directly edit your coin balance.', style: Theme.of(context).textTheme.bodyMedium)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GameCard extends StatelessWidget {
  const _GameCard({required this.icon, required this.title, required this.subtitle, required this.tag, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final String tag;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              CircleAvatar(radius: 28, child: Icon(icon, size: 28)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [Expanded(child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))), Chip(label: Text(tag))]),
                    Text(subtitle),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}


class _QuickCard extends StatelessWidget {
  const _QuickCard({required this.icon, required this.title, required this.onTap});
  final IconData icon; final String title; final VoidCallback onTap;
  @override Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(onTap:onTap,child:Padding(padding:const EdgeInsets.all(16),child:Column(children:[Icon(icon,size:30),const SizedBox(height:8),Text(title,textAlign:TextAlign.center,style:const TextStyle(fontWeight:FontWeight.w800))]))),
  );
}
