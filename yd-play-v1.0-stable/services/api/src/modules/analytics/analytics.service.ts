import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AnalyticsBatchDto } from './dto/analytics-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly db:DatabaseService){}
  async ingest(userId:string,dto:AnalyticsBatchDto){
    let accepted=0,duplicates=0;
    for(const e of dto.events){
      const row=await this.db.one<{id:string}>(
        `INSERT INTO analytics_events (user_id,event_id,event_name,platform,app_version,properties,occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
         ON CONFLICT (user_id,event_id) DO NOTHING RETURNING id`,
        [userId,e.eventId,e.eventName,e.platform??null,e.appVersion??null,JSON.stringify(e.properties??{}),e.occurredAt]
      );
      if(row) accepted++; else duplicates++;
    }
    return {accepted,duplicates};
  }
}
