import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { WalletService } from '../wallet/wallet.service';

interface MissionRow {
  id: string; code: string; title: string; description: string; trigger_type: string;
  target_value: string; reward_coins: string; repeat_type: 'one_time'|'daily'|'weekly'; metadata: Record<string,unknown>;
}

@Injectable()
export class EngagementService {
  constructor(private readonly db: DatabaseService, private readonly wallet: WalletService) {}

  private periodKey(repeat: string, at = new Date()): string {
    const y = at.getUTCFullYear();
    const m = String(at.getUTCMonth() + 1).padStart(2,'0');
    const d = String(at.getUTCDate()).padStart(2,'0');
    if (repeat === 'daily') return `${y}-${m}-${d}`;
    if (repeat === 'weekly') {
      const date = new Date(Date.UTC(y, at.getUTCMonth(), at.getUTCDate()));
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
      const week = Math.ceil((((date.getTime()-yearStart.getTime())/86400000)+1)/7);
      return `${date.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
    }
    return 'lifetime';
  }

  private leaderboardPeriod(period: string, at = new Date()): string {
    if (period === 'daily') return this.periodKey('daily', at);
    if (period === 'weekly') return this.periodKey('weekly', at);
    if (period === 'monthly') return `${at.getUTCFullYear()}-${String(at.getUTCMonth()+1).padStart(2,'0')}`;
    return 'all-time';
  }

  async recordPulseGridResult(input: { userId:string; sessionId:string; score:number; maxCombo:number; validated:boolean }) {
    if (!input.validated) return { processed:false, reason:'not_validated' };
    return this.db.tx(async (client) => {
      const receipt = await client.query<{idempotency_key:string}>(
        `INSERT INTO engagement_event_receipts (idempotency_key,user_id,event_type,payload)
         VALUES ($1,$2,'pulse_grid_completed',$3::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
        [`pulse-result:${input.sessionId}`, input.userId, JSON.stringify({score:input.score,maxCombo:input.maxCombo,sessionId:input.sessionId})]
      );
      if (!receipt.rows[0]) return { processed:false, duplicate:true };

      const missions = await client.query<MissionRow>(
        `SELECT id,code,title,description,trigger_type,target_value,reward_coins,repeat_type,metadata
         FROM missions WHERE is_active=true
           AND (active_from IS NULL OR active_from<=now())
           AND (active_to IS NULL OR active_to>=now())`
      );
      for (const mission of missions.rows) {
        const increment = mission.trigger_type === 'pulse_grid_completed' ? 1
          : mission.trigger_type === 'pulse_grid_score_1000' && input.score >= 1000 ? 1 : 0;
        if (!increment) continue;
        const key = this.periodKey(mission.repeat_type);
        await client.query(
          `INSERT INTO user_missions (user_id,mission_id,period_key,progress,completed_at)
           VALUES ($1,$2,$3,$4,CASE WHEN $4 >= $5 THEN now() ELSE NULL END)
           ON CONFLICT (user_id,mission_id,period_key) DO UPDATE SET
             progress = LEAST(EXCLUDED.progress + user_missions.progress, $5),
             completed_at = CASE WHEN LEAST(EXCLUDED.progress + user_missions.progress, $5) >= $5
                                 THEN COALESCE(user_missions.completed_at,now()) ELSE NULL END,
             updated_at=now()`,
          [input.userId, mission.id, key, increment, Number(mission.target_value)]
        );
      }

      const achievements = await client.query<{id:string;criteria:any}>(
        `SELECT id,criteria FROM achievements WHERE is_active=true`
      );
      for (const achievement of achievements.rows) {
        const event = achievement.criteria?.event;
        const threshold = Number(achievement.criteria?.threshold ?? 1);
        const matched = event === 'pulse_grid_completed'
          || (event === 'pulse_grid_score' && input.score >= threshold)
          || (event === 'pulse_grid_max_combo' && input.maxCombo >= threshold);
        if (!matched) continue;
        await client.query(
          `INSERT INTO user_achievements (user_id,achievement_id,metadata)
           VALUES ($1,$2,$3::jsonb) ON CONFLICT (user_id,achievement_id) DO NOTHING`,
          [input.userId, achievement.id, JSON.stringify({sessionId:input.sessionId,score:input.score,maxCombo:input.maxCombo})]
        );
      }

      const boards = await client.query<{id:string;period_type:string}>(
        `SELECT id,period_type FROM leaderboards WHERE is_active=true AND game_slug='pulse-grid'`
      );
      for (const board of boards.rows) {
        const key = this.leaderboardPeriod(board.period_type);
        await client.query(
          `INSERT INTO leaderboard_entries (leaderboard_id,period_key,user_id,score,games_played)
           VALUES ($1,$2,$3,$4,1)
           ON CONFLICT (leaderboard_id,period_key,user_id) DO UPDATE SET
             score=GREATEST(leaderboard_entries.score,EXCLUDED.score),
             games_played=leaderboard_entries.games_played+1,
             updated_at=now()`,
          [board.id,key,input.userId,input.score]
        );
      }
      return { processed:true };
    });
  }

  async missions(userId:string) {
    const rows = await this.db.query<any>(
      `SELECT m.id,m.code,m.title,m.description,m.target_value,m.reward_coins,m.repeat_type,m.metadata,
              COALESCE(um.progress,0) AS progress,um.completed_at,um.claimed_at
       FROM missions m
       LEFT JOIN user_missions um ON um.mission_id=m.id AND um.user_id=$1
        AND um.period_key = CASE m.repeat_type::text
          WHEN 'daily' THEN to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD')
          WHEN 'weekly' THEN to_char(now() AT TIME ZONE 'UTC','IYYY-"W"IW')
          ELSE 'lifetime' END
       WHERE m.is_active=true AND (m.active_from IS NULL OR m.active_from<=now()) AND (m.active_to IS NULL OR m.active_to>=now())
       ORDER BY m.repeat_type,m.code`, [userId]
    );
    return { items: rows.map(r=>({...r, targetValue:Number(r.target_value), rewardCoins:Number(r.reward_coins), progress:Number(r.progress), claimable:!!r.completed_at && !r.claimed_at})) };
  }

  async claimMission(userId:string, missionId:string) {
    const row = await this.db.one<any>(
      `SELECT m.id,m.reward_coins,m.repeat_type,um.period_key,um.completed_at,um.claimed_at,um.reward_transaction_id
       FROM missions m JOIN user_missions um ON um.mission_id=m.id AND um.user_id=$1
       WHERE m.id=$2 ORDER BY um.updated_at DESC LIMIT 1`, [userId,missionId]
    );
    if (!row) throw new NotFoundException('Mission progress not found');
    if (!row.completed_at) throw new ConflictException('Mission is not complete');
    if (row.claimed_at) return { claimed:true, duplicate:true, transactionId:row.reward_transaction_id };
    const reward = BigInt(row.reward_coins);
    const transfer = reward > 0n ? await this.wallet.transfer({
      idempotencyKey:`mission-reward:${userId}:${missionId}:${row.period_key}`,
      reason:'mission_reward', actorUserId:userId, fromAccountCode:'SYSTEM:MISSIONS', toAccountCode:`USER:${userId}`,
      amount:reward, referenceType:'mission', referenceId:missionId,
      metadata:{periodKey:row.period_key}
    }) : {transactionId:null as any};
    await this.db.query(`UPDATE user_missions SET claimed_at=COALESCE(claimed_at,now()),reward_transaction_id=COALESCE(reward_transaction_id,$4),updated_at=now()
      WHERE user_id=$1 AND mission_id=$2 AND period_key=$3`, [userId,missionId,row.period_key,transfer.transactionId]);
    return { claimed:true, rewardCoins:Number(row.reward_coins), transactionId:transfer.transactionId };
  }

  async achievements(userId:string) {
    const rows = await this.db.query<any>(
      `SELECT a.id,a.code,a.title,a.description,a.reward_coins,a.criteria,
              ua.unlocked_at,ua.claimed_at,ua.metadata
       FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=$1
       WHERE a.is_active=true ORDER BY a.code`, [userId]
    );
    return { items: rows.map(r=>({...r,rewardCoins:Number(r.reward_coins),unlocked:!!r.unlocked_at,claimable:!!r.unlocked_at&&!r.claimed_at})) };
  }

  async claimAchievement(userId:string, achievementId:string) {
    const row = await this.db.one<any>(
      `SELECT a.reward_coins,ua.unlocked_at,ua.claimed_at,ua.reward_transaction_id
       FROM achievements a JOIN user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=$1 WHERE a.id=$2`, [userId,achievementId]
    );
    if (!row) throw new NotFoundException('Achievement is not unlocked');
    if (row.claimed_at) return { claimed:true, duplicate:true, transactionId:row.reward_transaction_id };
    const reward = BigInt(row.reward_coins);
    const transfer = reward > 0n ? await this.wallet.transfer({
      idempotencyKey:`achievement-reward:${userId}:${achievementId}`, reason:'achievement_reward', actorUserId:userId,
      fromAccountCode:'SYSTEM:MISSIONS', toAccountCode:`USER:${userId}`, amount:reward,
      referenceType:'achievement', referenceId:achievementId
    }) : {transactionId:null as any};
    await this.db.query(`UPDATE user_achievements SET claimed_at=COALESCE(claimed_at,now()),reward_transaction_id=COALESCE(reward_transaction_id,$3)
      WHERE user_id=$1 AND achievement_id=$2`, [userId,achievementId,transfer.transactionId]);
    return { claimed:true, rewardCoins:Number(row.reward_coins), transactionId:transfer.transactionId };
  }

  async leaderboard(code:string, userId?:string, limit=50) {
    const board = await this.db.one<any>(`SELECT id,code,title,period_type FROM leaderboards WHERE code=$1 AND is_active=true`,[code]);
    if (!board) throw new NotFoundException('Leaderboard not found');
    const key = this.leaderboardPeriod(board.period_type);
    const safeLimit=Math.max(1,Math.min(100,Math.trunc(limit)));
    const items = await this.db.query<any>(
      `SELECT le.user_id,p.username,p.display_name,le.score,le.games_played,
              RANK() OVER (ORDER BY le.score DESC,le.updated_at ASC) AS rank
       FROM leaderboard_entries le JOIN profiles p ON p.user_id=le.user_id
       WHERE le.leaderboard_id=$1 AND le.period_key=$2
       ORDER BY le.score DESC,le.updated_at ASC LIMIT $3`, [board.id,key,safeLimit]
    );
    let me:any=null;
    if (userId) me = await this.db.one<any>(
      `SELECT ranked.* FROM (
        SELECT le.user_id,le.score,le.games_played,RANK() OVER (ORDER BY le.score DESC,le.updated_at ASC) AS rank
        FROM leaderboard_entries le WHERE le.leaderboard_id=$1 AND le.period_key=$2
       ) ranked WHERE ranked.user_id=$3`, [board.id,key,userId]
    );
    return { leaderboard:{code:board.code,title:board.title,periodType:board.period_type,periodKey:key}, items, me };
  }
}
