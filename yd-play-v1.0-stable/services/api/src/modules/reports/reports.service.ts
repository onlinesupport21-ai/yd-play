import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async listMine(reporterUserId: string, limit = 50) {
    const safe = Math.max(1, Math.min(100, Math.trunc(limit)));
    return { items: await this.db.query<any>(
      `SELECT id,target_user_id,source_type,source_id,category,details,status,resolution_note,created_at,updated_at,resolved_at
       FROM moderation_reports WHERE reporter_user_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [reporterUserId,safe]
    ) };
  }

  async create(reporterUserId: string, dto: CreateReportDto) {
    return this.db.one(
      `INSERT INTO moderation_reports
        (reporter_user_id,target_user_id,source_type,source_id,category,details)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,status,created_at`,
      [reporterUserId,dto.targetUserId??null,dto.sourceType,dto.sourceId??null,dto.category,dto.details??null]
    );
  }
}
