import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import 'safety_report_screen.dart';
import 'legal_screen.dart';
import '../config/app_config.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final TextEditingController displayName;
  late final TextEditingController bio;

  @override
  void initState() {
    super.initState();
    displayName = TextEditingController(text: widget.controller.user?.displayName ?? '');
    bio = TextEditingController(text: widget.controller.user?.bio ?? '');
  }

  @override
  void dispose() { displayName.dispose(); bio.dispose(); super.dispose(); }

  Future<void> _save() async {
    try {
      await widget.controller.updateProfile(displayName: displayName.text.trim(), bio: bio.text.trim());
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated')));
    } catch (_) {}
  }

  Future<void> _theme(String value) async {
    try { await widget.controller.updateProfile(theme: value); } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.controller.user!;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Profile', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 18),
          CircleAvatar(radius: 38, child: Text(user.displayName.isEmpty ? 'Y' : user.displayName[0].toUpperCase(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900))),
          const SizedBox(height: 12),
          Center(child: Text('@${user.username}', style: Theme.of(context).textTheme.titleMedium)),
          const SizedBox(height: 24),
          TextField(controller: displayName, decoration: const InputDecoration(labelText: 'Display name')),
          const SizedBox(height: 12),
          TextField(controller: bio, maxLines: 3, decoration: const InputDecoration(labelText: 'Bio')),
          const SizedBox(height: 12),
          FilledButton(onPressed: widget.controller.busy ? null : _save, child: const Text('Save profile')),
          const SizedBox(height: 24),
          Text('Appearance', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          RadioListTile(value: 'system', groupValue: user.theme, onChanged: (v) => v == null ? null : _theme(v), title: const Text('System')),
          RadioListTile(value: 'light', groupValue: user.theme, onChanged: (v) => v == null ? null : _theme(v), title: const Text('Light')),
          RadioListTile(value: 'dark', groupValue: user.theme, onChanged: (v) => v == null ? null : _theme(v), title: const Text('Dark')),
          const SizedBox(height: 16),
          Text('Game feedback', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          SwitchListTile(
            value: widget.controller.hapticsEnabled,
            onChanged: widget.controller.setHapticsEnabled,
            title: const Text('Haptics'),
            subtitle: const Text('Touch feedback for rounds and lane taps.'),
          ),
          SwitchListTile(
            value: widget.controller.soundsEnabled,
            onChanged: widget.controller.setSoundsEnabled,
            title: const Text('System sound cues'),
            subtitle: const Text('Short local sound cues. No copyrighted audio assets are bundled.'),
          ),
          const SizedBox(height: 16),
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Text('Account: ${user.email ?? 'No email added'}\nLocale: ${user.locale}\nApp: YD Play ${AppConfig.appVersion}'))),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SafetyReportScreen(controller: widget.controller))),
            icon: const Icon(Icons.shield_outlined),
            label: const Text('Safety & reports'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LegalScreen())),
            icon: const Icon(Icons.policy_outlined),
            label: const Text('About, privacy & legal'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: widget.controller.busy ? null : () async { try { await widget.controller.logout(); } catch (_) {} },
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
