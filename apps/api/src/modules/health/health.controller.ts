import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AppConfigService } from '../../common/config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';

interface HealthResponse {
  status: 'ok' | 'degraded';
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: 'up' | 'down';
  };
  features: {
    igdbConfigured: boolean;
    redisConfigured: boolean;
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Readiness probe, feature flags and dependency status' })
  @ApiOkResponse({ description: 'The API and its database are reachable' })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const databaseUp = await this.prisma.isHealthy();

    // A container orchestrator needs a non-200 when a hard dependency is down.
    response.status(databaseUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: databaseUp ? 'ok' : 'degraded',
      environment: this.config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseUp ? 'up' : 'down',
      },
      features: {
        igdbConfigured: this.config.igdb.configured,
        redisConfigured: this.config.redisUrl !== null,
      },
    };
  }
}
