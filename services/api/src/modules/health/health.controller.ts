import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get('live')
  live() {
    return {
      ok: true,
      service: 'yd-play-api',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      time: new Date().toISOString()
    };
  }

  @Get('ready')
  async ready() {
    try {
      const row = await this.db.one<{ ok: number }>('SELECT 1 AS ok');
      if (row?.ok !== 1) throw new Error('database check failed');
      return {
        ok: true,
        service: 'yd-play-api',
        version: '1.0.0',
        dependencies: { database: 'ready' },
        time: new Date().toISOString()
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'yd-play-api',
        version: '1.0.0',
        dependencies: { database: 'unavailable' },
        time: new Date().toISOString()
      });
    }
  }

  @Get()
  async health() {
    return this.ready();
  }
}
