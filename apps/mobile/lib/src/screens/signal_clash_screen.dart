import 'dart:async';

import 'package:flutter/material.dart';

import '../controller/app_controller.dart';
import '../models/models.dart';
import 'safety_report_screen.dart';

class SignalClashScreen extends StatefulWidget {
  const SignalClashScreen({super.key, required this.controller});
  final AppController controller;

  @override
  State<SignalClashScreen> createState() => _SignalClashScreenState();
}

class _SignalClashScreenState extends State<SignalClashScreen> {
  StreamSubscription<Map<String, dynamic>>? sub;
  MultiplayerRoom? room;
  int? roundNo;
  int? targetLane;
  DateTime? closesAt;
  int seq = 0;
  bool answered = false;
  bool connected = false;
  bool queueing = false;
  String status = 'Connecting…';
  final code = TextEditingController();
  Timer? reconnectTimer;
  bool disposing = false;

  @override
  void initState() {
    super.initState();
    sub = widget.controller.realtime.events.listen(_event);
    _connect();
  }

  Future<void> _connect() async {
    try {
      await widget.controller.realtime.connect();
      if (mounted) setState(() => status = 'Authenticating…');
    } catch (e) {
      if (mounted) setState(() => status = '$e');
    }
  }

  void _event(Map<String, dynamic> event) {
    final type = '${event['type'] ?? ''}';
    if (type == 'auth.ok') {
      connected = true;
      status = 'Ready';
    } else if (['room.created', 'room.joined', 'room.resume', 'room.updated', 'match.found', 'game.started'].contains(type)) {
      final raw = event['room'];
      if (raw is Map) {
        room = MultiplayerRoom.fromJson(raw.cast<String, dynamic>());
        final me = room!.players.where((p) => p.userId == widget.controller.user?.id);
        if (me.isNotEmpty) seq = me.first.lastInputSeq;
        final current = raw['currentRound'];
        if (current is Map) {
          final c = current.cast<String, dynamic>();
          roundNo = (c['roundNo'] as num?)?.toInt();
          targetLane = (c['targetLane'] as num?)?.toInt();
          closesAt = DateTime.tryParse('${c['closesAt'] ?? ''}');
          answered = false;
        }
      }
      queueing = false;
      status = type == 'match.found' ? 'Match found!' : 'Room ready';
    } else if (type == 'queue.joined') {
      queueing = true;
      status = 'Searching for another player…';
    } else if (type == 'queue.left') {
      queueing = false;
      status = 'Queue cancelled';
    } else if (type == 'game.round') {
      roundNo = (event['roundNo'] as num?)?.toInt();
      targetLane = (event['targetLane'] as num?)?.toInt();
      closesAt = DateTime.tryParse('${event['closesAt'] ?? ''}');
      answered = false;
      status = 'Round $roundNo';
      widget.controller.feedback.round();
    } else if (type == 'game.scoreboard') {
      final rawPlayers = (event['players'] as List?) ?? const [];
      final existing = room;
      if (existing != null) {
        room = MultiplayerRoom(
          id: existing.id,
          roomType: existing.roomType,
          status: existing.status,
          joinCode: existing.joinCode,
          startsAt: existing.startsAt,
          endsAt: existing.endsAt,
          players: rawPlayers.whereType<Map>().map((e) => MultiplayerPlayer.fromJson(e.cast<String, dynamic>())).toList(),
        );
      }
    } else if (type == 'game.input_result') {
      status = 'Your input: ${event['outcome'] ?? 'accepted'}';
    } else if (type == 'game.completed') {
      status = 'Match complete';
      roundNo = null;
      targetLane = null;
      _refreshRoom();
    } else if (type == 'game.cancelled') {
      status = 'Match cancelled';
      room = null;
    } else if (type == 'room.left' || type == 'room.player_left') {
      status = 'Player left';
    } else if (type == 'socket.closed') {
      connected = false;
      status = 'Disconnected. Reconnecting…';
      reconnectTimer?.cancel();
      if (!disposing) reconnectTimer = Timer(const Duration(seconds: 2), _connect);
    } else if (type == 'error') {
      status = 'Error: ${event['message'] ?? event['code'] ?? 'request failed'}';
    }
    if (mounted) setState(() {});
  }

  Future<void> _refreshRoom() async {
    final id = room?.id;
    if (id == null) return;
    try {
      room = MultiplayerRoom.fromJson(await widget.controller.api.get('/rooms/$id'));
      if (mounted) setState(() {});
    } catch (_) {}
  }

  void _send(String type, [Map<String, dynamic> extra = const {}]) {
    try { widget.controller.realtime.send({'type': type, ...extra}); } catch (e) { setState(() => status = '$e'); }
  }

  void _tapLane(int lane) {
    final r = room;
    final rn = roundNo;
    if (r == null || rn == null || answered) return;
    if (closesAt != null && DateTime.now().isAfter(closesAt!)) return;
    answered = true;
    seq += 1;
    widget.controller.feedback.tap();
    _send('game.input', {'roomId': r.id, 'roundNo': rn, 'lane': lane, 'seq': seq});
    setState(() {});
  }

  Future<void> _leave() async {
    _send('room.leave');
    room = null;
    roundNo = null;
    targetLane = null;
    queueing = false;
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    disposing = true;
    reconnectTimer?.cancel();
    sub?.cancel();
    code.dispose();
    widget.controller.realtime.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = room;
    return Scaffold(
      appBar: AppBar(title: const Text('Signal Clash'), actions: [IconButton(onPressed: connected ? null : _connect, icon: const Icon(Icons.refresh_rounded))]),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Card(child: ListTile(leading: Icon(connected ? Icons.wifi_rounded : Icons.wifi_off_rounded), title: Text(status), subtitle: const Text('Server-authoritative realtime match • no multiplayer coin reward in v0.7'))),
            if (r == null) ...[
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: connected && !queueing ? () => _send('queue.join') : null,
                icon: const Icon(Icons.search_rounded),
                label: Text(queueing ? 'Searching…' : 'Find public match'),
              ),
              if (queueing) TextButton(onPressed: () => _send('queue.leave'), child: const Text('Cancel search')),
              const SizedBox(height: 12),
              OutlinedButton.icon(onPressed: connected ? () => _send('room.create_private') : null, icon: const Icon(Icons.lock_rounded), label: const Text('Create private room')),
              const SizedBox(height: 22),
              TextField(controller: code, textCapitalization: TextCapitalization.characters, maxLength: 6, decoration: const InputDecoration(labelText: '6-character private room code')),
              FilledButton.tonal(onPressed: connected ? () => _send('room.join_private', {'code': code.text.trim().toUpperCase()}) : null, child: const Text('Join private room')),
            ] else ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(r.roomType == 'private' ? 'Private room' : 'Public match', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                  Text('Status: ${r.status}'),
                ])),
                if (r.joinCode != null) Chip(label: SelectableText(r.joinCode!, style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2))),
              ]),
              const SizedBox(height: 12),
              ...r.players.map((p) => Card(child: ListTile(
                leading: CircleAvatar(child: Text('${p.seatNo}')),
                title: Text(p.userId == widget.controller.user?.id ? 'You' : 'Opponent'),
                subtitle: Text('${p.connected ? 'Online' : 'Reconnecting'} • ${p.correct} correct • ${p.wrong} wrong'),
                trailing: Text('${p.score}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
              ))),
              const SizedBox(height: 16),
              if (targetLane != null) ...[
                Text('ROUND $roundNo', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10),
                  itemCount: 4,
                  itemBuilder: (context, lane) {
                    final active = targetLane == lane;
                    return FilledButton(
                      onPressed: answered ? null : () => _tapLane(lane),
                      style: FilledButton.styleFrom(
                        backgroundColor: active ? Theme.of(context).colorScheme.tertiary : Theme.of(context).colorScheme.primaryContainer,
                        foregroundColor: active ? Theme.of(context).colorScheme.onTertiary : Theme.of(context).colorScheme.onPrimaryContainer,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                      ),
                      child: Text('${lane + 1}', style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
                    );
                  },
                ),
              ] else
                Card(child: Padding(padding: const EdgeInsets.all(24), child: Center(child: Text(r.status == 'completed' ? 'Match complete' : 'Waiting for the next round…')))),
              const SizedBox(height: 18),
              if (r.players.any((p) => p.userId != widget.controller.user?.id))
                OutlinedButton.icon(
                  onPressed: () {
                    final opponent = r.players.firstWhere((p) => p.userId != widget.controller.user?.id);
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => SafetyReportScreen(
                      controller: widget.controller,
                      targetUserId: opponent.userId,
                      sourceType: 'game',
                      sourceId: r.id,
                    )));
                  },
                  icon: const Icon(Icons.flag_outlined),
                  label: const Text('Report opponent'),
                ),
              const SizedBox(height: 10),
              OutlinedButton.icon(onPressed: _leave, icon: const Icon(Icons.exit_to_app_rounded), label: const Text('Leave room')),
            ],
            const SizedBox(height: 18),
            const Text('Signal Clash currently awards no coins while latency fairness, reconnect behavior, and abuse resistance are being validated.', textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
