import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import '../widgets/brand_mark.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool registerMode = false;
  bool acceptedAge = false;
  final identifier = TextEditingController();
  final email = TextEditingController();
  final username = TextEditingController();
  final displayName = TextEditingController();
  final password = TextEditingController();
  final referral = TextEditingController();

  @override
  void dispose() {
    for (final c in [identifier, email, username, displayName, password, referral]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (registerMode && !acceptedAge) {
      _snack('Please confirm the age requirement for your region.');
      return;
    }
    try {
      if (registerMode) {
        await widget.controller.register(
          email: email.text.trim(),
          username: username.text.trim(),
          displayName: displayName.text.trim(),
          password: password.text,
          referralCode: referral.text.trim(),
        );
      } else {
        await widget.controller.login(identifier.text.trim(), password.text);
      }
    } catch (_) {
      if (mounted) _snack(widget.controller.error ?? 'Could not sign in');
    }
  }

  void _snack(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  @override
  Widget build(BuildContext context) {
    final busy = widget.controller.busy;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Align(alignment: Alignment.centerLeft, child: BrandMark(size: 64)),
                  const SizedBox(height: 24),
                  Text(registerMode ? 'Create your YD Play account' : 'Welcome back',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  Text('Play for virtual coins only. Coins have no cash value and cannot be withdrawn.',
                      style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 28),
                  if (registerMode) ...[
                    TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (optional)')),
                    const SizedBox(height: 12),
                    TextField(controller: username, decoration: const InputDecoration(labelText: 'Username')),
                    const SizedBox(height: 12),
                    TextField(controller: displayName, decoration: const InputDecoration(labelText: 'Display name')),
                    const SizedBox(height: 12),
                  ] else ...[
                    TextField(controller: identifier, decoration: const InputDecoration(labelText: 'Email or username')),
                    const SizedBox(height: 12),
                  ],
                  TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password (10+ characters)')),
                  if (registerMode) ...[
                    const SizedBox(height: 12),
                    TextField(controller: referral, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Referral code (optional)')),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: acceptedAge,
                      onChanged: (v) => setState(() => acceptedAge = v ?? false),
                      title: const Text('I meet the minimum age requirement for my region.'),
                      subtitle: const Text('YD Play has no gambling, deposits, cash-out, or real-money prizes.'),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: busy ? null : _submit,
                    style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 17)),
                    child: busy
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(registerMode ? 'Create account' : 'Sign in'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: busy ? null : () => setState(() => registerMode = !registerMode),
                    child: Text(registerMode ? 'Already have an account? Sign in' : 'New here? Create account'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
