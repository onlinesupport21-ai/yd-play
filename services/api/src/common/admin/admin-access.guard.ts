import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AdminAccessPayload, AdminPrincipal } from './admin.types';

@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly db: DatabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      admin?: AdminPrincipal;
    }>();

    const auth = req.headers.authorization;
    const rawAuth = Array.isArray(auth) ? auth[0] : auth;
    if (rawAuth?.startsWith('Bearer ')) {
      const token = rawAuth.slice(7);
      const secret = this.config.get<string>('ADMIN_JWT_SECRET');
      if (!secret || secret.length < 32) throw new Error('ADMIN_JWT_SECRET must be at least 32 characters');
      try {
        const payload = await this.jwt.verifyAsync<AdminAccessPayload>(token, { secret });
        if (payload.type !== 'admin-access') throw new Error('wrong token type');
        const session = await this.db.one<{ id: string }>(
          `SELECT s.id
           FROM admin_sessions s
           JOIN admin_users a ON a.id = s.admin_user_id
           WHERE s.id = $1
             AND s.admin_user_id = $2
             AND s.token_hash = $3
             AND s.revoked_at IS NULL
             AND s.expires_at > now()
             AND a.is_active = true`,
          [payload.sid, payload.sub, createHash('sha256').update(token).digest('hex')]
        );
        if (!session) throw new Error('session revoked');
        req.admin = {
          id: payload.sub,
          sessionId: payload.sid,
          email: payload.email,
          role: payload.role,
          source: 'jwt'
        };
        return true;
      } catch {
        throw new UnauthorizedException('Invalid, expired or revoked admin token');
      }
    }

    // Bootstrap compatibility only. Keep this secret out of the browser admin app.
    const configured = this.config.get<string>('ADMIN_API_KEY');
    const rawKey = req.headers['x-admin-api-key'];
    const supplied = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (configured && configured.length >= 24 && supplied) {
      const a = Buffer.from(supplied);
      const b = Buffer.from(configured);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        req.admin = {
          id: 'bootstrap-admin-key',
          email: 'bootstrap@local',
          role: 'super_admin',
          source: 'bootstrap-key'
        };
        return true;
      }
    }

    throw new UnauthorizedException('Admin credentials required');
  }
}
