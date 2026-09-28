import { Request, Response } from 'express';
import { config } from '../config';
import { HealthResponse } from '@reachinbox/shared';
import { getElasticsearchHealth } from '../services/search';

export function getHealth(_req: Request, res: Response): void {
  const responseData: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
    environment: config.NODE_ENV,
    version: '0.1.0',
  };

  res.status(200).json(responseData);
}

export async function getElasticsearchHealthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  const esHealth = await getElasticsearchHealth();
  const isHealthy = esHealth.status === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    elasticsearch: esHealth,
  });
}
