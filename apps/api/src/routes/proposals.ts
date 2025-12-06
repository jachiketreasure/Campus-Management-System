import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  createProposal,
  listProposalsForGig,
  acceptProposal,
  listOrdersForUser
} from '../services/proposal-service';
import { getGigById } from '../services/gig-service';

const proposalSchema = z.object({
  gigId: z.string(),
  message: z.string().min(10),
  amount: z.coerce.number().positive(),
  deliveryTimeDays: z.coerce.number().int().positive()
});

const acceptSchema = z.object({
  buyerId: z.string(),
  proposalId: z.string()
});

export const proposalsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  app.get('/:gigId', async (request, reply) => {
    const params = z.object({ gigId: z.string() }).parse(request.params);

    const gig = await getGigById(params.gigId);
    if (!gig) {
      return reply.code(404).send({
        errors: [{ code: 'NOT_FOUND', message: 'Gig not found' }]
      });
    }

    const proposals = await listProposalsForGig(params.gigId);
    return { data: proposals };
  });

  app.post(
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

      const body = proposalSchema.parse(request.body);

      const gig = await getGigById(body.gigId);
      if (!gig) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Gig not found' }]
        });
      }

      const proposal = await createProposal(user.id, body);
      return reply.code(201).send({ data: proposal });
    }
  );

  app.post(
    '/accept',
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

      const body = acceptSchema.parse(request.body);

      try {
        const order = await acceptProposal(body.proposalId, body.buyerId, user.id);
        return reply.code(201).send({ data: order });
      } catch (error) {
        if (error instanceof Error && (error as { statusCode?: number }).statusCode === 404) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: error.message }]
          });
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to accept proposal' }]
        });
      }
    }
  );

  app.get(
    '/orders/me',
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

      const orders = await listOrdersForUser(user.id);
      return { data: orders };
    }
  );
};

