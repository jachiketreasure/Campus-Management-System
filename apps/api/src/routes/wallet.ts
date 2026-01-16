import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  createDispute,
  depositToEscrow,
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

const depositSchema = z.object({
  contractId: z.string(),
  amount: z.coerce.number().nonnegative()
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

  // Deposit to escrow for contract
  app.post(
    '/deposit',
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

      const body = depositSchema.parse(request.body);

      try {
        const transaction = await depositToEscrow(body.contractId, user.id, body.amount);
        return { data: transaction };
      } catch (error) {
        if (error instanceof Error && (error as unknown as { statusCode?: number }).statusCode) {
          const statusCode = (error as unknown as { statusCode: number }).statusCode;
          if (statusCode === 403) {
            return reply.code(403).send({
              errors: [{ code: 'FORBIDDEN', message: error.message }]
            });
          }
          if (statusCode === 404) {
            return reply.code(404).send({
              errors: [{ code: 'NOT_FOUND', message: error.message }]
            });
          }
          if (statusCode === 400) {
            return reply.code(400).send({
              errors: [{ code: 'BAD_REQUEST', message: error.message }]
            });
          }
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to deposit to escrow' }]
        });
      }
    }
  );
};

