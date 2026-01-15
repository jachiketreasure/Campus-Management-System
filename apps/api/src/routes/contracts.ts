import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  createContract,
  getContractById,
  getContractsByUser,
  getContractByGig,
  submitWork,
  approveWork,
  disputeContract
} from '../services/contract-service';

const contractBodySchema = z.object({
  gigId: z.string(),
  applicationId: z.string(),
  agreedPrice: z.coerce.number().nonnegative(),
  dueDate: z.string().datetime().optional()
});

const submitWorkSchema = z.object({
  workSubmissionUrl: z.string().url(),
  workSubmissionNotes: z.string().optional()
});

export const contractsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  // Create contract (hire applicant)
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

      const body = contractBodySchema.parse(request.body);

      try {
        const contract = await createContract(user.id, body);
        return reply.code(201).send({ data: contract });
      } catch (error) {
        if (error instanceof Error && (error as { statusCode?: number }).statusCode) {
          const statusCode = (error as { statusCode: number }).statusCode;
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
          if (statusCode === 409) {
            return reply.code(409).send({
              errors: [{ code: 'CONFLICT', message: error.message }]
            });
          }
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to create contract' }]
        });
      }
    }
  );

  // Get user's contracts
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

      const contracts = await getContractsByUser(user.id);
      return { data: contracts };
    }
  );

  // Get contract by ID
  app.get(
    '/:contractId',
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

      const params = z.object({ contractId: z.string() }).parse(request.params);
      const contract = await getContractById(params.contractId);

      if (!contract) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Contract not found' }]
        });
      }

      return { data: contract };
    }
  );

  // Get contract by gig
  app.get(
    '/gig/:gigId',
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

      const params = z.object({ gigId: z.string() }).parse(request.params);
      const contract = await getContractByGig(params.gigId);
      return { data: contract };
    }
  );

  // Submit work (worker only)
  app.post(
    '/:contractId/submit',
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

      const params = z.object({ contractId: z.string() }).parse(request.params);
      const body = submitWorkSchema.parse(request.body);

      try {
        const contract = await submitWork(
          params.contractId,
          user.id,
          body.workSubmissionUrl,
          body.workSubmissionNotes
        );

        if (!contract) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Contract not found' }]
          });
        }

        return { data: contract };
      } catch (error) {
        if (error instanceof Error && (error as { statusCode?: number }).statusCode) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode === 403) {
            return reply.code(403).send({
              errors: [{ code: 'FORBIDDEN', message: error.message }]
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
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to submit work' }]
        });
      }
    }
  );

  // Approve work (employer only)
  app.post(
    '/:contractId/approve',
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

      const params = z.object({ contractId: z.string() }).parse(request.params);

      try {
        const contract = await approveWork(params.contractId, user.id);

        if (!contract) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Contract not found' }]
          });
        }

        return { data: contract };
      } catch (error) {
        if (error instanceof Error && (error as { statusCode?: number }).statusCode) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode === 403) {
            return reply.code(403).send({
              errors: [{ code: 'FORBIDDEN', message: error.message }]
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
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to approve work' }]
        });
      }
    }
  );

  // Dispute contract
  app.post(
    '/:contractId/dispute',
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

      const params = z.object({ contractId: z.string() }).parse(request.params);

      try {
        const contract = await disputeContract(params.contractId, user.id);

        if (!contract) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Contract not found' }]
          });
        }

        return { data: contract };
      } catch (error) {
        if (error instanceof Error && (error as { statusCode?: number }).statusCode) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode === 403) {
            return reply.code(403).send({
              errors: [{ code: 'FORBIDDEN', message: error.message }]
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
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to dispute contract' }]
        });
      }
    }
  );
};

