import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from '../services/notification-service';

const listQuerySchema = z.object({
  category: z.enum(['SYSTEM', 'GIG', 'ATTENDANCE', 'EXAM', 'MALPRACTICE', 'FINANCE']).optional(),
  read: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  app.get(
    '/',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
      }

      const query = listQuerySchema.parse(request.query);
      const notifications = await listNotifications(user.id, query);
      return { data: notifications };
    }
  );

  app.get(
    '/unread-count',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
      }

      const count = await getUnreadCount(user.id);
      return { data: { count } };
    }
  );

  app.post(
    '/:notificationId/read',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
      }

      const params = z.object({ notificationId: z.string() }).parse(request.params);

      try {
        const notification = await markAsRead(params.notificationId, user.id);
        return { data: notification };
      } catch (error) {
        if (error instanceof Error && (error as unknown as { statusCode?: number }).statusCode === 404) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Notification not found' }]
          });
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to mark notification as read' }]
        });
      }
    }
  );

  app.post(
    '/read-all',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
      }

      const count = await markAllAsRead(user.id);
      return { data: { count } };
    }
  );
};
