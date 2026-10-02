import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralsService } from '../referrals/referrals.service';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password';
import { LoginDto } from './dto/login.dto';

interface UserLoginRow {
  id: string;
  email: string | null;
  password_hash: string;
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  username: string;
  display_name: string;
}

interface RefreshPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly wallets: WalletService,
    private readonly referrals: ReferralsService
  ) {}

  private deviceHash(deviceProof: string): string {
    return createHash('sha256').update(`ydplay-device-v1:${deviceProof}`).digest('hex');
  }

  private refreshHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokenConfig() {
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are required');
    }
    return {
      accessSecret,
      refreshSecret,
      accessTtl: Number(this.config.get('ACCESS_TOKEN_TTL_SECONDS') ?? 900),
      refreshTtl: Number(this.config.get('REFRESH_TOKEN_TTL_SECONDS') ?? 2592000)
    };
  }

  private async issueTokens(userId: string, sessionId: string) {
    const cfg = this.tokenConfig();
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'access' },
      { secret: cfg.accessSecret, expiresIn: cfg.accessTtl }
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'refresh' },
      { secret: cfg.refreshSecret, expiresIn: cfg.refreshTtl }
    );
    return { accessToken, refreshToken, cfg };
  }

  async register(dto: RegisterDto, ip: string, _userAgent?: string) {
    if (!dto.ageGateAccepted) {
      throw new ConflictException('Age gate must be accepted');
    }

    const passwordHash = await hashPassword(dto.password);
    const dHash = this.deviceHash(dto.deviceProof);

    let userId: string;
    let sessionId: string;

    try {
      const created = await this.db.tx(async (client) => {
        const userResult = await client.query<{ id: string }>(
          `INSERT INTO users
            (email, password_hash, age_gate_version, age_gate_accepted_at)
           VALUES ($1, $2, 'v1', now())
           RETURNING id`,
          [dto.email ?? null, passwordHash]
        );
        const id = userResult.rows[0].id;

        await client.query(
          `INSERT INTO profiles (user_id, username, display_name)
           VALUES ($1, $2, $3)`,
          [id, dto.username, dto.displayName]
        );

        const deviceResult = await client.query<{ id: string }>(
          `INSERT INTO devices
            (user_id, device_hash, platform, app_version, first_seen_ip, last_seen_ip)
           VALUES ($1, $2, $3, $4, $5, $5)
           RETURNING id`,
          [id, dHash, dto.platform, dto.appVersion ?? null, ip]
        );

        await this.wallets.createUserWallet(client, id);

        // Create placeholder session first; refresh hash is replaced after signing.
        const sessionResult = await client.query<{ id: string }>(
          `INSERT INTO sessions
            (user_id, device_id, refresh_token_hash, expires_at)
           VALUES ($1, $2, 'pending', now() + interval '30 days')
           RETURNING id`,
          [id, deviceResult.rows[0].id]
        );

        return { userId: id, sessionId: sessionResult.rows[0].id };
      });
      userId = created.userId;
      sessionId = created.sessionId;
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Email or username already exists');
      }
      throw error;
    }

    const tokens = await this.issueTokens(userId, sessionId);
    await this.db.query(
      `UPDATE sessions
       SET refresh_token_hash = $2,
           expires_at = now() + ($3 * interval '1 second')
       WHERE id = $1`,
      [sessionId, this.refreshHash(tokens.refreshToken), tokens.cfg.refreshTtl]
    );

    await this.wallets.grantSignupBonus(userId);
    const referral = await this.referrals.onUserRegistered(userId, dto.referralCode, ip);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.publicUser(userId),
      wallet: await this.wallets.getUserWallet(userId),
      referral
    };
  }

  async login(dto: LoginDto, ip: string, _userAgent?: string) {
    const user = await this.db.one<UserLoginRow>(
      `SELECT
         u.id, u.email, u.password_hash, u.status,
         p.username, p.display_name
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1 OR p.username = $1
       LIMIT 1`,
      [dto.identifier]
    );

    if (!user || !(await verifyPassword(user.password_hash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    const dHash = this.deviceHash(dto.deviceProof);

    const device = await this.db.one<{ id: string }>(
      `INSERT INTO devices
        (user_id, device_hash, platform, app_version, first_seen_ip, last_seen_ip)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (user_id, device_hash)
       DO UPDATE SET
         last_seen_ip = EXCLUDED.last_seen_ip,
         last_seen_at = now(),
         app_version = EXCLUDED.app_version
       RETURNING id`,
      [user.id, dHash, dto.platform, dto.appVersion ?? null, ip]
    );
    if (!device) throw new Error('Failed to create device');

    const session = await this.db.one<{ id: string }>(
      `INSERT INTO sessions
        (user_id, device_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, 'pending', now() + interval '30 days')
       RETURNING id`,
      [user.id, device.id]
    );
    if (!session) throw new Error('Failed to create session');

    const tokens = await this.issueTokens(user.id, session.id);
    await this.db.query(
      `UPDATE sessions
       SET refresh_token_hash = $2,
           expires_at = now() + ($3 * interval '1 second')
       WHERE id = $1`,
      [session.id, this.refreshHash(tokens.refreshToken), tokens.cfg.refreshTtl]
    );

    await this.db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.publicUser(user.id),
      wallet: await this.wallets.getUserWallet(user.id)
    };
  }

  async refresh(refreshToken: string) {
    const cfg = this.tokenConfig();

    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: cfg.refreshSecret
      });
      if (payload.type !== 'refresh') throw new Error('Wrong token type');
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.db.tx(async (client) => {
      const sessionResult = await client.query<{
        id: string;
        user_id: string;
        device_id: string | null;
        refresh_token_hash: string;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        `SELECT
           id, user_id, device_id, refresh_token_hash, expires_at, revoked_at
         FROM sessions
         WHERE id = $1
         FOR UPDATE`,
        [payload.sid]
      );

      const session = sessionResult.rows[0];
      if (
        !session ||
        session.revoked_at ||
        session.user_id !== payload.sub ||
        session.expires_at <= new Date() ||
        session.refresh_token_hash !== this.refreshHash(refreshToken)
      ) {
        throw new UnauthorizedException('Refresh session is no longer valid');
      }

      const replacementResult = await client.query<{ id: string }>(
        `INSERT INTO sessions
          (user_id, device_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, 'pending', now() + ($3 * interval '1 second'))
         RETURNING id`,
        [session.user_id, session.device_id, cfg.refreshTtl]
      );
      const replacementId = replacementResult.rows[0].id;
      const tokens = await this.issueTokens(session.user_id, replacementId);

      await client.query(
        `UPDATE sessions
         SET refresh_token_hash = $2
         WHERE id = $1`,
        [replacementId, this.refreshHash(tokens.refreshToken)]
      );

      const revoked = await client.query(
        `UPDATE sessions
         SET revoked_at = now(), replaced_by_session_id = $2
         WHERE id = $1 AND revoked_at IS NULL`,
        [session.id, replacementId]
      );
      if (revoked.rowCount !== 1) {
        throw new UnauthorizedException('Refresh token replay detected');
      }

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    });
  }

  async logout(sessionId: string) {
    await this.db.query(
      `UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1`,
      [sessionId]
    );
  }

  private async publicUser(userId: string) {
    const row = await this.db.one<{
      id: string;
      email: string | null;
      username: string;
      display_name: string;
      locale: string;
      status: string;
    }>(
      `SELECT u.id, u.email, p.username, p.display_name, u.locale, u.status
       FROM users u JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    if (!row) throw new UnauthorizedException('User not found');
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.display_name,
      locale: row.locale,
      status: row.status
    };
  }
}
