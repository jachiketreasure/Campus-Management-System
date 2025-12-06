import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { z } from 'zod';
import {
  createAliveCheck,
  respondToAliveCheck,
  getAliveCheckStatus,
  getAliveChecksForSession,
  type AliveCheckConfig,
} from '../services/alive-check-service';

const createCheckSchema = z.object({
  examSessionId: z.string().optional(),
  monitoringSessionId: z.string().optional(),
  config: z
    .object({
      checkInterval: z.number().optional(),
      responseWindow: z.number().optional(),
      maxMissedChecks: z.number().optional(),
      actionOnMaxMisses: z.enum(['WARN', 'PAUSE_EXAM', 'AUTO_SUBMIT', 'FLAG_FOR_REVIEW']).optional(),
      challengeTypes: z.array(z.enum(['BUTTON_CLICK', 'TYPE_WORD', 'MATH_PUZZLE'])).optional(),
      initialDelay: z.number().optional(),
    })
    .optional(),
});

const respondSchema = z.object({
  checkId: z.string(),
  response: z.union([z.string(), z.number()]),
});

export const aliveCheckRoutes: FastifyPluginAsync = async (app) => {
  // Extract user info from headers
  app.addHook('preHandler', async (request) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    (request as any).userId = userId;
    (request as any).userRole = userRole;
  });

  // Create a new alive check (for students)
  app.post('/create', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      if (!userId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
        });
      }

      const body = createCheckSchema.parse(request.body);
      const result = await createAliveCheck(
        userId,
        body.examSessionId,
        body.monitoringSessionId,
        body.config as Partial<AliveCheckConfig>
      );

      return { data: result };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error creating alive check');
      return reply.code(400).send({
        errors: [
          {
            code: 'BAD_REQUEST',
            message: error.message || 'Failed to create alive check',
          },
        ],
      });
    }
  });

  // Respond to an alive check (for students)
  app.post('/respond', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      if (!userId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
        });
      }

      const body = respondSchema.parse(request.body);
      const result = await respondToAliveCheck(body.checkId, userId, body.response);

      return { data: result };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error responding to alive check');
      return reply.code(400).send({
        errors: [
          {
            code: 'BAD_REQUEST',
            message: error.message || 'Failed to respond to alive check',
          },
        ],
      });
    }
  });

  // Get alive check status (for students)
  app.get('/status', async (request, reply) => {
    try {
      const userId = (request as any).userId;
      if (!userId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
        });
      }

      const examSessionId = (request.query as any)?.examSessionId;
      const monitoringSessionId = (request.query as any)?.monitoringSessionId;

      const status = await getAliveCheckStatus(
        userId,
        examSessionId,
        monitoringSessionId
      );

      return { data: status };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error getting alive check status');
      return reply.code(500).send({
        errors: [
          {
            code: 'INTERNAL_ERROR',
            message: error.message || 'Failed to get alive check status',
          },
        ],
      });
    }
  });

  // Get all alive checks for a session (for admins/lecturers)
  app.get('/session', async (request, reply) => {
    try {
      const userRole = (request as any).userRole;
      if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }],
        });
      }

      const examSessionId = (request.query as any)?.examSessionId;
      const monitoringSessionId = (request.query as any)?.monitoringSessionId;

      if (!examSessionId && !monitoringSessionId) {
        return reply.code(400).send({
          errors: [
            {
              code: 'BAD_REQUEST',
              message: 'Either examSessionId or monitoringSessionId is required',
            },
          ],
        });
      }

      const checks = await getAliveChecksForSession(examSessionId, monitoringSessionId);

      return { data: checks };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error getting alive checks for session');
      return reply.code(500).send({
        errors: [
          {
            code: 'INTERNAL_ERROR',
            message: error.message || 'Failed to get alive checks',
          },
        ],
      });
    }
  });
};






