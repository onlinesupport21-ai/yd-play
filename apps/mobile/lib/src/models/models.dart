class UserProfile {
  const UserProfile({
    required this.id,
    required this.username,
    required this.displayName,
    this.email,
    this.bio,
    this.theme = 'system',
    this.locale = 'en-IN',
  });

  final String id;
  final String username;
  final String displayName;
  final String? email;
  final String? bio;
  final String theme;
  final String locale;

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: '${json['id'] ?? ''}',
        username: '${json['username'] ?? ''}',
        displayName: '${json['displayName'] ?? json['display_name'] ?? ''}',
        email: json['email'] as String?,
        bio: json['bio'] as String?,
        theme: '${json['theme'] ?? 'system'}',
        locale: '${json['locale'] ?? 'en-IN'}',
      );
}

class WalletSummary {
  const WalletSummary({required this.balance});
  final int balance;

  factory WalletSummary.fromJson(Map<String, dynamic> json) => WalletSummary(
        balance: int.tryParse('${json['balance'] ?? 0}') ?? 0,
      );
}

class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.reason,
    required this.delta,
    required this.balanceAfter,
    required this.createdAt,
  });

  final String id;
  final String reason;
  final int delta;
  final int balanceAfter;
  final DateTime createdAt;

  factory WalletTransaction.fromJson(Map<String, dynamic> json) => WalletTransaction(
        id: '${json['id'] ?? ''}',
        reason: '${json['reason'] ?? ''}',
        delta: int.tryParse('${json['delta'] ?? 0}') ?? 0,
        balanceAfter: int.tryParse('${json['balanceAfter'] ?? 0}') ?? 0,
        createdAt: DateTime.tryParse('${json['createdAt'] ?? ''}') ?? DateTime.now(),
      );
}

class ReferralSummary {
  const ReferralSummary({
    required this.code,
    required this.total,
    required this.rewarded,
    required this.pending,
    required this.review,
    required this.earnedCoins,
    required this.inviterReward,
    required this.inviteeReward,
  });

  final String code;
  final int total;
  final int rewarded;
  final int pending;
  final int review;
  final int earnedCoins;
  final int inviterReward;
  final int inviteeReward;

  factory ReferralSummary.fromJson(Map<String, dynamic> json) {
    final invited = (json['invited'] as Map?)?.cast<String, dynamic>() ?? const {};
    final program = (json['program'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ReferralSummary(
      code: '${json['code'] ?? ''}',
      total: int.tryParse('${invited['total'] ?? 0}') ?? 0,
      rewarded: int.tryParse('${invited['rewarded'] ?? 0}') ?? 0,
      pending: int.tryParse('${invited['pending'] ?? 0}') ?? 0,
      review: int.tryParse('${invited['review'] ?? 0}') ?? 0,
      earnedCoins: int.tryParse('${json['earnedCoins'] ?? 0}') ?? 0,
      inviterReward: int.tryParse('${program['inviterReward'] ?? 0}') ?? 0,
      inviteeReward: int.tryParse('${program['inviteeReward'] ?? 0}') ?? 0,
    );
  }
}

class PulseCue {
  const PulseCue({required this.index, required this.timeMs, required this.lane});
  final int index;
  final int timeMs;
  final int lane;

  factory PulseCue.fromJson(Map<String, dynamic> json) => PulseCue(
        index: (json['index'] as num).toInt(),
        timeMs: (json['timeMs'] as num).toInt(),
        lane: (json['lane'] as num).toInt(),
      );
}

class MultiplayerPlayer {
  const MultiplayerPlayer({
    required this.userId,
    required this.seatNo,
    required this.connected,
    required this.score,
    required this.correct,
    required this.wrong,
    required this.lastInputSeq,
  });

  final String userId;
  final int seatNo;
  final bool connected;
  final int score;
  final int correct;
  final int wrong;
  final int lastInputSeq;

  factory MultiplayerPlayer.fromJson(Map<String, dynamic> json) => MultiplayerPlayer(
        userId: '${json['userId'] ?? ''}',
        seatNo: (json['seatNo'] as num?)?.toInt() ?? 0,
        connected: json['connected'] == true,
        score: (json['score'] as num?)?.toInt() ?? 0,
        correct: (json['correct'] as num?)?.toInt() ?? 0,
        wrong: (json['wrong'] as num?)?.toInt() ?? 0,
        lastInputSeq: (json['lastInputSeq'] as num?)?.toInt() ?? 0,
      );
}

class MultiplayerRoom {
  const MultiplayerRoom({
    required this.id,
    required this.roomType,
    required this.status,
    required this.players,
    this.joinCode,
    this.startsAt,
    this.endsAt,
  });

  final String id;
  final String roomType;
  final String status;
  final String? joinCode;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final List<MultiplayerPlayer> players;

  factory MultiplayerRoom.fromJson(Map<String, dynamic> json) => MultiplayerRoom(
        id: '${json['id'] ?? ''}',
        roomType: '${json['roomType'] ?? ''}',
        status: '${json['status'] ?? ''}',
        joinCode: json['joinCode'] as String?,
        startsAt: DateTime.tryParse('${json['startsAt'] ?? ''}'),
        endsAt: DateTime.tryParse('${json['endsAt'] ?? ''}'),
        players: ((json['players'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => MultiplayerPlayer.fromJson(e.cast<String, dynamic>()))
            .toList(),
      );
}

class MissionProgress {
  const MissionProgress({required this.id, required this.title, required this.description, required this.progress, required this.targetValue, required this.rewardCoins, required this.claimable, required this.claimed});
  final String id; final String title; final String description; final int progress; final int targetValue; final int rewardCoins; final bool claimable; final bool claimed;
  factory MissionProgress.fromJson(Map<String,dynamic> json) => MissionProgress(
    id:'${json['id']??''}', title:'${json['title']??''}', description:'${json['description']??''}',
    progress:int.tryParse('${json['progress']??0}')??0, targetValue:int.tryParse('${json['targetValue']??json['target_value']??0}')??0,
    rewardCoins:int.tryParse('${json['rewardCoins']??json['reward_coins']??0}')??0,
    claimable:json['claimable']==true, claimed:json['claimed_at']!=null,
  );
}

class AchievementProgress {
  const AchievementProgress({required this.id,required this.title,required this.description,required this.rewardCoins,required this.unlocked,required this.claimable,required this.claimed});
  final String id,title,description; final int rewardCoins; final bool unlocked,claimable,claimed;
  factory AchievementProgress.fromJson(Map<String,dynamic> json)=>AchievementProgress(
    id:'${json['id']??''}',title:'${json['title']??''}',description:'${json['description']??''}',rewardCoins:int.tryParse('${json['rewardCoins']??json['reward_coins']??0}')??0,
    unlocked:json['unlocked']==true,claimable:json['claimable']==true,claimed:json['claimed_at']!=null,
  );
}

class LeaderboardEntry {
  const LeaderboardEntry({required this.userId,required this.username,required this.displayName,required this.score,required this.rank,required this.gamesPlayed});
  final String userId,username,displayName; final int score,rank,gamesPlayed;
  factory LeaderboardEntry.fromJson(Map<String,dynamic> json)=>LeaderboardEntry(
    userId:'${json['user_id']??json['userId']??''}',username:'${json['username']??''}',displayName:'${json['display_name']??json['displayName']??''}',
    score:int.tryParse('${json['score']??0}')??0,rank:int.tryParse('${json['rank']??0}')??0,gamesPlayed:int.tryParse('${json['games_played']??json['gamesPlayed']??0}')??0,
  );
}

class AppNotificationItem {
  const AppNotificationItem({required this.id,required this.title,required this.body,required this.createdAt,this.readAt});
  final String id,title,body; final DateTime createdAt; final DateTime? readAt;
  bool get unread=>readAt==null;
  factory AppNotificationItem.fromJson(Map<String,dynamic> json)=>AppNotificationItem(
    id:'${json['id']??''}',title:'${json['title']??''}',body:'${json['body']??''}',createdAt:DateTime.tryParse('${json['created_at']??json['createdAt']??''}')??DateTime.now(),readAt:DateTime.tryParse('${json['read_at']??json['readAt']??''}'),
  );
}

class UserReportItem {
  const UserReportItem({required this.id,required this.category,required this.status,required this.createdAt,this.details,this.resolutionNote});
  final String id,category,status; final String? details,resolutionNote; final DateTime createdAt;
  factory UserReportItem.fromJson(Map<String,dynamic> json)=>UserReportItem(
    id:'${json['id']??''}',category:'${json['category']??''}',status:'${json['status']??''}',details:json['details'] as String?,resolutionNote:json['resolution_note'] as String?,createdAt:DateTime.tryParse('${json['created_at']??''}')??DateTime.now(),
  );
}
