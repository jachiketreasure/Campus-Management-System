import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  createApplication,
  getApplicationsByGig,
  getApplicationById,
  getUserApplicationForGig,
  rejectApplication,
  updateApplicationStatus
} from '../services/application-service';

const applicationBodySchema = z.object({
  gigId: z.string(),
  message: z.string().optional(),
  attachmentUrl: z.string().url().optional()
});

export const applicationsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  // Create application
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

      const body = applicationBodySchema.parse(request.body);

      try {
        const application = await createApplication(user.id, body);
        return reply.code(201).send({ data: application });
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
          if (statusCode === 409) {
            return reply.code(409).send({
              errors: [{ code: 'CONFLICT', message: error.message }]
            });
          }
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to create application' }]
        });
      }
    }
  );

  // Get applications for a gig
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
      const applications = await getApplicationsByGig(params.gigId);
      return { data: applications };
    }
  );

  // Get user's application for a gig
  app.get(
    '/gig/:gigId/my-application',
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
      const application = await getUserApplicationForGig(params.gigId, user.id);
      return { data: application };
    }
  );

  // Get application by ID
  app.get(
    '/:applicationId',
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

      const params = z.object({ applicationId: z.string() }).parse(request.params);
      const application = await getApplicationById(params.applicationId);
      
      if (!application) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Application not found' }]
        });
      }

      return { data: application };
    }
  );

  // Reject application (gig owner only)
  app.post(
    '/:applicationId/reject',
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

      const params = z.object({ applicationId: z.string() }).parse(request.params);

      try {
        const application = await rejectApplication(params.applicationId, user.id);
        if (!application) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Application not found' }]
          });
        }

        return { data: application };
      } catch (error) {
        if (error instanceof Error && (error as unknown as { statusCode?: number }).statusCode === 403) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: error.message }]
          });
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to reject application' }]
        });
      }
    }
  );
};

