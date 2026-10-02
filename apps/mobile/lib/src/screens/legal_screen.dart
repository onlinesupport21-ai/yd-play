import 'package:flutter/material.dart';

import '../config/app_config.dart';

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('About & legal')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('YD Play', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text('Release Candidate • ${AppConfig.appVersion}'),
          const SizedBox(height: 22),
          const _Section(
            title: 'Virtual coins only',
            body: 'YD Play coins are entertainment-only virtual points. They have no cash value, cannot be withdrawn, cannot be exchanged for money, and are not a deposit or investment.',
          ),
          const _Section(
            title: 'No gambling or betting',
            body: 'YD Play does not provide real-money betting, wagering, cash prizes, deposits, cash-out, or loot boxes designed to imitate gambling.',
          ),
          const _Section(
            title: 'Fair play',
            body: 'Game scores and rewards are validated by the server. Attempts to automate play, tamper with clients, farm accounts, manipulate referrals, or abuse rewards may be reviewed and restricted.',
          ),
          const _Section(
            title: 'Community safety',
            body: 'Users can report abusive behaviour. Reports are reviewed before moderation action; a report by itself does not automatically ban another user.',
          ),
          const _Section(
            title: 'Privacy',
            body: 'YD Play stores account, session, game, referral, moderation and security data needed to operate the service. Device-abuse signals are designed to use privacy-preserving hashes rather than raw hardware identifiers. Production deployment must publish a jurisdiction-appropriate Privacy Policy and Terms of Service before public release.',
          ),
          const _Section(
            title: 'Age & regional availability',
            body: 'The applicable age gate and service availability must follow the rules for the user’s region. This release candidate is intended for private testing until the final compliance review is complete.',
          ),
          const SizedBox(height: 12),
          Text(
            'This in-app notice is a product summary, not a substitute for final legal review.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(body),
          ],
        ),
      ),
    );
  }
}
