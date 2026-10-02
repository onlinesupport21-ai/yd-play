import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async getMe(userId: string) {
    const row = await this.db.one<{
      id: string;
      email: string | null;
      status: string;
      locale: string;
      username: string;
      display_name: string;
      bio: string | null;
      theme: string;
      created_at: Date;
    }>(
      `SELECT
        u.id, u.email, u.status, u.locale, u.created_at,
        p.username, p.display_name, p.bio, p.theme
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    if (!row) throw new NotFoundException('User not found');

    return {
      id: row.id,
      email: row.email,
      status: row.status,
      locale: row.locale,
      username: row.username,
      displayName: row.display_name,
      bio: row.bio,
      theme: row.theme,
      createdAt: row.created_at
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const row = await this.db.one<{
      username: string;
      display_name: string;
      bio: string | null;
      theme: string;
    }>(
      `UPDATE profiles
       SET
         display_name = COALESCE($2, display_name),
         bio = COALESCE($3, bio),
         theme = COALESCE($4, theme),
         updated_at = now()
       WHERE user_id = $1
       RETURNING username, display_name, bio, theme`,
      [userId, dto.displayName ?? null, dto.bio ?? null, dto.theme ?? null]
    );
    if (!row) throw new NotFoundException('Profile not found');
    return {
      username: row.username,
      displayName: row.display_name,
      bio: row.bio,
      theme: row.theme
    };
  }
}
