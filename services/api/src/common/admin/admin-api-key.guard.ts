import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const configured = this.config.get<string>('ADMIN_API_KEY');
    if (!configured || configured.length < 24) {
      throw new Error('ADMIN_API_KEY must be configured and at least 24 characters');
    }

    const raw = req.headers['x-admin-api-key'];
    const supplied = Array.isArray(raw) ? raw[0] : raw;
    if (!supplied) throw new UnauthorizedException('Admin credentials required');

    const a = Buffer.from(supplied);
    const b = Buffer.from(configured);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid admin credentials');
    }
    return true;
  }
}
