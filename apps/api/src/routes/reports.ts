import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import {
  generateTransactionsReport,
  generateGigsReport,
  generateOrdersReport
} from '../services/reporting-service';

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  app.get(
    '/transactions',
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

      try {
        const csv = await generateTransactionsReport(user.id);
        reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="transactions-${Date.now()}.csv"`)
          .send(csv);
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Failed to generate transactions report' }]
        });
      }
    }
  );

  app.get(
    '/gigs',
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

      try {
        // Only return gigs owned by the user (unless admin)
        const ownerId = user.roles?.includes('ADMIN') ? undefined : user.id;
        const csv = await generateGigsReport(ownerId);
        reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="gigs-${Date.now()}.csv"`)
          .send(csv);
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Failed to generate gigs report' }]
        });
      }
    }
  );

  app.get(
    '/orders',
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

      try {
        const csv = await generateOrdersReport(user.id);
        reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`)
          .send(csv);
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Failed to generate orders report' }]
        });
      }
    }
  );
};
