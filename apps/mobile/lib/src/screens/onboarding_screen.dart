import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import '../widgets/brand_mark.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final pageController = PageController();
  int page = 0;

  static const pages = <_OnboardingPage>[
    _OnboardingPage(
      icon: Icons.sports_esports_rounded,
      title: 'Play original arcade games',
      body: 'Pulse Grid and Signal Clash are built for quick sessions with server-validated results.',
    ),
    _OnboardingPage(
      icon: Icons.verified_user_rounded,
      title: 'Fair play is server-authoritative',
      body: 'Scores, multiplayer rounds and coin rewards are validated by the backend—not trusted from the phone.',
    ),
    _OnboardingPage(
      icon: Icons.toll_rounded,
      title: 'Coins are virtual only',
      body: 'No deposits, betting, cash-out or real-money prizes. Virtual coins have no real-world value.',
    ),
  ];

  @override
  void dispose() {
    pageController.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    await widget.controller.feedback.tap();
    if (page == pages.length - 1) {
      await widget.controller.completeOnboarding();
      return;
    }
    await pageController.nextPage(duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 16, 12, 0),
              child: Row(
                children: [
                  const BrandMark(size: 46),
                  const SizedBox(width: 12),
                  const Text('YD Play', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  const Spacer(),
                  if (page < pages.length - 1)
                    TextButton(onPressed: widget.controller.completeOnboarding, child: const Text('Skip')),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: pageController,
                itemCount: pages.length,
                onPageChanged: (value) => setState(() => page = value),
                itemBuilder: (context, index) {
                  final item = pages[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 30),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 154,
                          height: 154,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Theme.of(context).colorScheme.primaryContainer,
                                Theme.of(context).colorScheme.tertiaryContainer,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(44),
                          ),
                          child: Icon(item.icon, size: 76, color: Theme.of(context).colorScheme.onPrimaryContainer),
                        ),
                        const SizedBox(height: 38),
                        Text(item.title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 14),
                        Text(item.body, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.5)),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(pages.length, (index) => AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: index == page ? 28 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: index == page ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(20),
                ),
              )),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _next,
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 18)),
                  icon: Icon(page == pages.length - 1 ? Icons.play_arrow_rounded : Icons.arrow_forward_rounded),
                  label: Text(page == pages.length - 1 ? 'Start YD Play' : 'Continue'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPage {
  const _OnboardingPage({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;
}
