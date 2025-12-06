import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';
import { z } from 'zod';
import {
  getAvailableRegistrationNumbers,
  markRegistrationNumberAsUsed,
  initializeRegistrationNumberPool,
  getAvailableRegistrationNumberCount,
} from '../services/registration-number-service';

const markAsUsedSchema = z.object({
  registrationNumber: z.string(),
});

export const registrationNumberRoutes: FastifyPluginAsync = async (app) => {
  // Extract user info from headers (like exam-integrity routes)
  app.addHook('preHandler', async (request) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    (request as any).userId = userId;
    (request as any).userRole = userRole;
  });

  // Get available registration numbers
  app.get(
    '/available',
    async (request, reply) => {
      try {
        const userRole = (request as any).userRole;
        const userId = (request as any).userId;
        
        // Check if user is admin
        if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }],
          });
        }

        // Initialize pool if empty
        const poolStatus = await initializeRegistrationNumberPool();
        
        const availableNumbers = await getAvailableRegistrationNumbers();
        const availableCount = await getAvailableRegistrationNumberCount();

        return {
          data: availableNumbers,
          meta: {
            available: availableCount,
            total: availableNumbers.length,
            poolInitialized: poolStatus.initialized,
          },
        };
      } catch (error: any) {
        request.log.error({ err: error }, 'Error getting available registration numbers');
        return reply.code(500).send({
          errors: [
            {
              code: 'INTERNAL_ERROR',
              message: error.message || 'Failed to get available registration numbers',
            },
          ],
        });
      }
    }
  );

  // Mark registration number as used
  app.post(
    '/mark-used',
    async (request, reply) => {
      try {
        const userRole = (request as any).userRole;
        const userId = (request as any).userId;
        
        // Check if user is admin
        if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }],
          });
        }

        const body = markAsUsedSchema.parse(request.body);
        const success = await markRegistrationNumberAsUsed(
          body.registrationNumber,
          userId || ''
        );

        if (!success) {
          return reply.code(400).send({
            errors: [
              {
                code: 'BAD_REQUEST',
                message:
                  'Registration number not found or already used',
              },
            ],
          });
        }

        return { data: { success: true } };
      } catch (error: any) {
        request.log.error({ err: error }, 'Error marking registration number as used');
        return reply.code(500).send({
          errors: [
            {
              code: 'INTERNAL_ERROR',
              message: error.message || 'Failed to mark registration number as used',
            },
          ],
        });
      }
    }
  );

  // Initialize pool (admin only)
  app.post(
    '/initialize',
    async (request, reply) => {
      try {
        const userRole = (request as any).userRole;
        
        // Check if user is admin
        if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }],
          });
        }

        const result = await initializeRegistrationNumberPool();
        return { data: result };
      } catch (error: any) {
        request.log.error({ err: error }, 'Error initializing registration number pool');
        return reply.code(500).send({
          errors: [
            {
              code: 'INTERNAL_ERROR',
              message: error.message || 'Failed to initialize registration number pool',
            },
          ],
        });
      }
    }
  );
};

