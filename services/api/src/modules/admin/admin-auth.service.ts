import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { AdminRole } from '../../common/admin/admin.types';
import { verifyPassword } from '../auth/password';
import { AdminLoginDto } from './dto/admin-login.dto';

interface AdminRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(dto: AdminLoginDto, ip?: string, userAgent?: string) {
    const admin = await this.db.one<AdminRow>(
      `SELECT id, email, display_name, password_hash, role, is_active
       FROM admin_users WHERE email = $1 LIMIT 1`,
      [dto.email]
    );
    if (!admin || !admin.is_active || !(await verifyPassword(admin.password_hash, dto.password))) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const secret = this.config.get<string>('ADMIN_JWT_SECRET');
    if (!secret || secret.length < 32) throw new Error('ADMIN_JWT_SECRET must be at least 32 characters');
    const ttl = Number(this.config.get('ADMIN_ACCESS_TOKEN_TTL_SECONDS') ?? 1800);

    const session = await this.db.one<{ id: string }>(
      `INSERT INTO admin_sessions
        (admin_user_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1, $5, now() + ($2 * interval '1 second'), $3, $4)
       RETURNING id`,
      [admin.id, ttl, ip ?? null, userAgent ?? null, `pending:${randomUUID()}`]
    );
    if (!session) throw new Error('Failed to create admin session');

    const accessToken = await this.jwt.signAsync(
      {
        sub: admin.id,
        sid: session.id,
        role: admin.role,
        email: admin.email,
        type: 'admin-access'
      },
      { secret, expiresIn: ttl }
    );

    await this.db.query(
      `UPDATE admin_sessions SET token_hash = $2 WHERE id = $1`,
      [session.id, createHash('sha256').update(accessToken).digest('hex')]
    );
    await this.db.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [admin.id]);

    return {
      accessToken,
      expiresIn: ttl,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name,
        role: admin.role
      }
    };
  }

  async logout(sessionId?: string) {
    if (sessionId) {
      await this.db.query('UPDATE admin_sessions SET revoked_at = now() WHERE id = $1', [sessionId]);
    }
    return { ok: true };
  }
}
