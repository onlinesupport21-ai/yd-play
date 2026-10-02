import 'dart:async';

import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import '../models/models.dart';

class PulseGridScreen extends StatefulWidget {
  const PulseGridScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<PulseGridScreen> createState() => _PulseGridScreenState();
}

class _PulseGridScreenState extends State<PulseGridScreen> {
  String? sessionId;
  DateTime? startedAt;
  Duration clockOffset = Duration.zero;
  int durationMs = 45000;
  int hitWindowMs = 230;
  int lanes = 4;
  int seq = 0;
  int score = 0;
  int combo = 0;
  int hits = 0;
  int misses = 0;
  int lastCueIndex = -1;
  final Map<int, PulseCue> cues = {};
  Timer? timer;
  bool starting = true;
  bool completing = false;
  String message = 'Starting…';
  Map<String, dynamic>? finalResult;

  int get elapsedMs {
    final start = startedAt;
    if (start == null) return 0;
    return DateTime.now().add(clockOffset).difference(start).inMilliseconds.clamp(0, durationMs + 5000).toInt();
  }

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() { timer?.cancel(); super.dispose(); }

  Future<void> _start() async {
    try {
      final data = await widget.controller.api.post('/games/pulse-grid/sessions');
      sessionId = '${data['id']}';
      startedAt = DateTime.parse('${data['startedAt']}');
      final serverNow = DateTime.parse('${data['serverNow']}');
      clockOffset = serverNow.difference(DateTime.now());
      durationMs = (data['durationMs'] as num).toInt();
      hitWindowMs = (data['hitWindowMs'] as num).toInt();
      lanes = (data['lanes'] as num).toInt();
      message = 'Tap the lane when its pulse arrives.';
      starting = false;
      timer = Timer.periodic(const Duration(milliseconds: 120), (_) => _tick());
      await _fetchCues();
      if (mounted) setState(() {});
    } catch (e) {
      message = '$e';
      starting = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> _tick() async {
    if (!mounted || completing || finalResult != null) return;
    if (elapsedMs >= durationMs + 300) {
      await _complete();
      return;
    }
    if (elapsedMs % 600 < 140) await _fetchCues();
    setState(() {});
  }

  Future<void> _fetchCues() async {
    final id = sessionId;
    if (id == null) return;
    try {
      final data = await widget.controller.api.get('/games/sessions/$id/cues', query: {'after': '$lastCueIndex'});
      for (final raw in (data['items'] as List?) ?? const []) {
        if (raw is Map) {
          final cue = PulseCue.fromJson(raw.cast<String, dynamic>());
          cues[cue.index] = cue;
          if (cue.index > lastCueIndex) lastCueIndex = cue.index;
        }
      }
    } catch (_) {}
  }

  PulseCue? _activeCue() {
    final now = elapsedMs;
    PulseCue? best;
    var distance = 1 << 30;
    for (final cue in cues.values) {
      final d = (cue.timeMs - now).abs();
      if (d <= hitWindowMs + 80 && d < distance) { best = cue; distance = d; }
    }
    return best;
  }

  Future<void> _tap(int lane) async {
    final id = sessionId;
    if (id == null || completing || finalResult != null || elapsedMs >= durationMs) return;
    await widget.controller.feedback.tap();
    seq += 1;
    try {
      final data = await widget.controller.api.post('/games/sessions/$id/input', body: {
        'seq': seq,
        'elapsedMs': elapsedMs,
        'lane': lane,
      });
      score = (data['score'] as num?)?.toInt() ?? score;
      combo = (data['combo'] as num?)?.toInt() ?? combo;
      hits = (data['hits'] as num?)?.toInt() ?? hits;
      misses = (data['misses'] as num?)?.toInt() ?? misses;
      message = data['outcome'] == 'hit' ? 'Perfect! + score' : '${data['outcome'] ?? 'Input accepted'}';
      if (data['outcome'] == 'hit') await widget.controller.feedback.success();
    } catch (e) {
      seq -= 1;
      message = '$e';
    }
    if (mounted) setState(() {});
  }

  Future<void> _complete() async {
    final id = sessionId;
    if (id == null || completing) return;
    completing = true;
    timer?.cancel();
    if (mounted) setState(() {});
    try {
      finalResult = await widget.controller.api.post('/games/sessions/$id/complete', body: {'claimedScore': score});
      score = (finalResult!['authoritativeScore'] as num?)?.toInt() ?? score;
      await widget.controller.refreshDashboard();
    } catch (e) {
      message = '$e';
      completing = false;
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final cue = _activeCue();
    final remaining = ((durationMs - elapsedMs).clamp(0, durationMs) / 1000).toStringAsFixed(1);
    final result = finalResult;
    return Scaffold(
      appBar: AppBar(title: const Text('Pulse Grid')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: starting
              ? const Center(child: CircularProgressIndicator())
              : result != null
                  ? _Result(data: result)
                  : Column(
                      children: [
                        Row(children: [
                          Expanded(child: _Metric(label: 'TIME', value: '${remaining}s')),
                          const SizedBox(width: 8),
                          Expanded(child: _Metric(label: 'SCORE', value: '$score')),
                          const SizedBox(width: 8),
                          Expanded(child: _Metric(label: 'COMBO', value: '$combo')),
                        ]),
                        const SizedBox(height: 16),
                        LinearProgressIndicator(value: (elapsedMs / durationMs).clamp(0.0, 1.0).toDouble()),
                        const SizedBox(height: 18),
                        Text(message, textAlign: TextAlign.center),
                        const Spacer(),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12),
                          itemCount: lanes,
                          itemBuilder: (context, lane) {
                            final active = cue?.lane == lane;
                            return FilledButton(
                              onPressed: completing ? null : () => _tap(lane),
                              style: FilledButton.styleFrom(
                                backgroundColor: active ? Theme.of(context).colorScheme.tertiary : Theme.of(context).colorScheme.primaryContainer,
                                foregroundColor: active ? Theme.of(context).colorScheme.onTertiary : Theme.of(context).colorScheme.onPrimaryContainer,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                              ),
                              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Icon(active ? Icons.bolt_rounded : Icons.circle_outlined, size: 44),
                                const SizedBox(height: 8),
                                Text('LANE ${lane + 1}', style: const TextStyle(fontWeight: FontWeight.w900)),
                              ]),
                            );
                          },
                        ),
                        const Spacer(),
                        Text('Hits $hits • Misses $misses', style: Theme.of(context).textTheme.bodyMedium),
                        const SizedBox(height: 8),
                        const Text('Server-authoritative score • virtual coins have no cash value', textAlign: TextAlign.center),
                      ],
                    ),
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)), Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900))])));
}

class _Result extends StatelessWidget {
  const _Result({required this.data});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final reward = (data['reward'] as Map?)?.cast<String, dynamic>() ?? const {};
    return Center(child: SingleChildScrollView(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(data['validated'] == true ? Icons.verified_rounded : Icons.gpp_bad_rounded, size: 72),
      const SizedBox(height: 14),
      Text(data['validated'] == true ? 'Run validated' : 'Run invalidated', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
      const SizedBox(height: 20),
      Text('${data['authoritativeScore'] ?? 0}', style: const TextStyle(fontSize: 54, fontWeight: FontWeight.w900)),
      const Text('authoritative score'),
      const SizedBox(height: 16),
      Text('Hits ${data['hits'] ?? 0} • Misses ${data['misses'] ?? 0} • Max combo ${data['maxCombo'] ?? 0}'),
      const SizedBox(height: 12),
      Chip(label: Text('Reward: ${reward['amount'] ?? 0} virtual coins (${reward['status'] ?? 'none'})')),
      const SizedBox(height: 18),
      FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Back to YD Play')),
    ])));
  }
}
