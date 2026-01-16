import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@cms/database';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/live', async () => ({
    status: 'live',
    timestamp: new Date().toISOString()
  }));

  app.get('/ready', async () => {
    try {
      await (prisma as any).$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
};

