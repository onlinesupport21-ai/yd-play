import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import '../models/models.dart';

class EngagementScreen extends StatefulWidget {
  const EngagementScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<EngagementScreen> createState() => _EngagementScreenState();
}

class _EngagementScreenState extends State<EngagementScreen>
    with SingleTickerProviderStateMixin {
  late final TabController tabs;
  bool loading = true;
  String? error;
  List<MissionProgress> missions = [];
  List<AchievementProgress> achievements = [];
  List<LeaderboardEntry> leaderboard = [];
  Map<String, dynamic>? me;
  String board = 'pulse-daily';

  @override
  void initState() {
    super.initState();
    tabs = TabController(length: 3, vsync: this);
    _load();
    widget.controller.trackEvent('engagement_open');
  }

  @override
  void dispose() {
    tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final results = await Future.wait([
        widget.controller.api.get('/missions'),
        widget.controller.api.get('/achievements'),
        widget.controller.api.get('/leaderboards/$board'),
      ]);
      missions = ((results[0]['items'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => MissionProgress.fromJson(e.cast<String, dynamic>()))
          .toList();
      achievements = ((results[1]['items'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => AchievementProgress.fromJson(e.cast<String, dynamic>()))
          .toList();
      leaderboard = ((results[2]['items'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => LeaderboardEntry.fromJson(e.cast<String, dynamic>()))
          .toList();
      me = (results[2]['me'] as Map?)?.cast<String, dynamic>();
      error = null;
    } catch (e) {
      error = '$e';
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _claimMission(String id) async {
    try {
      await widget.controller.api.post('/missions/$id/claim');
      await widget.controller.refreshDashboard();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _claimAchievement(String id) async {
    try {
      await widget.controller.api.post('/achievements/$id/claim');
      await widget.controller.refreshDashboard();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _switchBoard(String value) async {
    board = value;
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Goals & Rankings'),
        bottom: TabBar(
          controller: tabs,
          tabs: const [
            Tab(text: 'Missions'),
            Tab(text: 'Achievements'),
            Tab(text: 'Rankings'),
          ],
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : TabBarView(
                  controller: tabs,
                  children: [
                    _missionsTab(),
                    _achievementsTab(),
                    _rankingsTab(),
                  ],
                ),
    );
  }

  Widget _missionsTab() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: missions.map((m) {
          final progress = m.targetValue <= 0
              ? 0.0
              : (m.progress / m.targetValue).clamp(0.0, 1.0);
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          m.title,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
                        ),
                      ),
                      Chip(label: Text('+${m.rewardCoins} coins')),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(m.description),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(value: progress),
                  const SizedBox(height: 6),
                  Text('${m.progress}/${m.targetValue}'),
                  if (m.claimable) ...[
                    const SizedBox(height: 10),
                    FilledButton(
                      onPressed: () => _claimMission(m.id),
                      child: const Text('Claim reward'),
                    ),
                  ] else if (m.claimed) ...[
                    const SizedBox(height: 8),
                    const Text('Claimed ✓'),
                  ],
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _achievementsTab() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: achievements
            .map(
              (a) => Card(
                child: ListTile(
                  leading: Icon(
                    a.unlocked ? Icons.emoji_events_rounded : Icons.lock_outline_rounded,
                  ),
                  title: Text(
                    a.title,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: Text('${a.description}\n${a.rewardCoins} virtual coins'),
                  isThreeLine: true,
                  trailing: a.claimable
                      ? FilledButton(
                          onPressed: () => _claimAchievement(a.id),
                          child: const Text('Claim'),
                        )
                      : a.claimed
                          ? const Icon(Icons.check_circle_rounded)
                          : null,
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _rankingsTab() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            value: board,
            items: const [
              DropdownMenuItem(value: 'pulse-daily', child: Text('Today')),
              DropdownMenuItem(value: 'pulse-weekly', child: Text('This week')),
              DropdownMenuItem(value: 'pulse-all-time', child: Text('All time')),
            ],
            onChanged: (value) => value == null ? null : _switchBoard(value),
            decoration: const InputDecoration(labelText: 'Pulse Grid leaderboard'),
          ),
          if (me != null) ...[
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.person_rounded),
                title: const Text('Your rank'),
                trailing: Text('#${me!['rank'] ?? '—'} • ${me!['score'] ?? 0}'),
              ),
            ),
          ],
          const SizedBox(height: 12),
          ...leaderboard.map(
            (e) => Card(
              child: ListTile(
                leading: CircleAvatar(child: Text('${e.rank}')),
                title: Text(e.displayName.isEmpty ? e.username : e.displayName),
                subtitle: Text('@${e.username} • ${e.gamesPlayed} games'),
                trailing: Text(
                  '${e.score}',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
