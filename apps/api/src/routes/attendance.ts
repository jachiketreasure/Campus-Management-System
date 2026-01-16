import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  createSession,
  listSessions,
  listStudentRecords,
  qrCheckIn
} from '../services/attendance-service';

const createSessionSchema = z.object({
  courseId: z.string(),
  scheduledAt: z.string(),
  mode: z.enum(['QR', 'BIOMETRIC', 'DIGITAL']),
  metadata: z.record(z.string(), z.any()).optional()
});

const querySchema = z.object({
  status: z.enum(['SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED']).optional()
});

const checkinSchema = z.object({
  sessionId: z.string(),
  token: z.string(),
  studentId: z.string(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number()
    })
    .optional(),
  device: z
    .object({
      id: z.string(),
      platform: z.string()
    })
    .optional()
});

export const attendanceRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  app.post(
    '/sessions',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;

      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }]
        });
      }

      const body = createSessionSchema.parse(request.body);
      const session = await createSession(user.id, body);

      return reply.code(201).send({ data: session });
    }
  );

  app.get(
    '/sessions',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;

      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }]
        });
      }

      const query = querySchema.parse(request.query);
      const sessions = await listSessions(user.id, query.status);

      return { data: sessions };
    }
  );

  app.get(
    '/records/me',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;

      if (!user?.roles.includes('STUDENT')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Student access required' }]
        });
      }

      const records = await listStudentRecords(user.id);
      return { data: records };
    }
  );

  app.post('/qr-checkin', async (request, reply) => {
    try {
      const body = checkinSchema.parse(request.body);
      const record = await qrCheckIn(body);

      return reply.code(200).send({ data: record });
    } catch (error) {
      if (error instanceof Error && (error as unknown as { statusCode?: number }).statusCode === 404) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: error.message }]
        });
      }

      app.log.error(error);
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: 'Unable to process check-in' }]
      });
    }
  });
};

