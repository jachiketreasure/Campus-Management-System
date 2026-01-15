import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  reportLecturerAbsence,
  confirmLecturerAbsence,
  getLecturerAbsences
} from '../services/lecturer-absence-service';

const reportAbsenceSchema = z.object({
  courseId: z.string(),
  sessionId: z.string(),
  semester: z.string(),
  absenceDate: z.string().datetime(),
  reason: z.string().optional()
});

export const lecturerAbsenceRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  // Report lecturer absence (student)
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

      const body = reportAbsenceSchema.parse(request.body);

      try {
        const absence = await reportLecturerAbsence(user.id, body);
        return reply.code(201).send({ data: absence });
      } catch (error) {
        if (error instanceof Error && (error as { statusCode?: number }).statusCode) {
          const statusCode = (error as { statusCode: number }).statusCode;
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
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to report absence' }]
        });
      }
    }
  );

  // Get absences for a course
  app.get(
    '/course/:courseId',
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

      const params = z.object({
        courseId: z.string(),
        sessionId: z.string(),
        semester: z.string()
      }).parse({ ...request.params, ...request.query });

      const absences = await getLecturerAbsences(params.courseId, params.sessionId, params.semester);
      return { data: absences };
    }
  );

  // Confirm absence (admin only)
  app.post(
    '/:absenceId/confirm',
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

      if (!user.roles?.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }

      const params = z.object({ absenceId: z.string() }).parse(request.params);

      const absence = await confirmLecturerAbsence(params.absenceId, user.id);
      if (!absence) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Absence not found' }]
        });
      }

      return { data: absence };
    }
  );
};

