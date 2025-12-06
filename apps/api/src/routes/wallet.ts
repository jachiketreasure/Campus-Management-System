import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  createDispute,
  getWalletSummary,
  listDisputes,
  listTransactions,
  releaseEscrow
} from '../services/wallet-service';

const releaseSchema = z.object({
  orderId: z.string()
});

const disputeSchema = z.object({
  orderId: z.string(),
  description: z.string().min(10)
});

export const walletRoutes: FastifyPluginAsync = async (app) => {
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

      const summary = await getWalletSummary(user.id);
      return { data: summary };
    }
  );

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

      const transactions = await listTransactions(user.id);
      return { data: transactions };
    }
  );

  app.post(
    '/release',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }

      const body = releaseSchema.parse(request.body);
      const transaction = await releaseEscrow(body.orderId);
      if (!transaction) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Pending escrow not found for order' }]
        });
      }

      return { data: transaction };
    }
  );

  app.get(
    '/disputes',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }

      const disputes = await listDisputes();
      return { data: disputes };
    }
  );

  app.post(
    '/disputes',
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

      const body = disputeSchema.parse(request.body);
      const dispute = await createDispute(body.orderId, user.id, body.description);

      return reply.code(201).send({ data: dispute });
    }
  );
};

