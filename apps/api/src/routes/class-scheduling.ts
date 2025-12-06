import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  createPhysicalClass,
  createOnlineClass,
  regenerateQrCode,
  getQrCodeData,
  scanQrAttendance,
  enterAttendanceCode,
  listLecturerClasses,
  getClassDetails,
  listStudentClasses,
  startClass,
  closeClass,
} from '../services/class-scheduling-service';

const createPhysicalClassSchema = z.object({
  courseId: z.string(),
  scheduledAt: z.string(),
  duration: z.number().int().positive(),
  venue: z.string().min(1),
});

const createOnlineClassSchema = z.object({
  courseId: z.string(),
  classTitle: z.string().min(1),
  scheduledAt: z.string(),
  duration: z.number().int().positive(),
  meetingPlatform: z.string().min(1),
  meetingLink: z.string().url(),
});

const scanQrSchema = z.object({
  qrData: z.string(),
});

const enterCodeSchema = z.object({
  sessionId: z.string(),
  code: z.string().min(1),
});

export const classSchedulingRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(request, reply);
  };

  // Lecturer routes
  app.post(
    '/classes/physical',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      try {
        const body = createPhysicalClassSchema.parse(request.body);
        const classSession = await createPhysicalClass(user.id, body);
        return reply.code(201).send({ data: classSession });
      } catch (error: any) {
        app.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message || 'Failed to create physical class' }],
        });
      }
    }
  );

  app.post(
    '/classes/online',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      try {
        const body = createOnlineClassSchema.parse(request.body);
        const classSession = await createOnlineClass(user.id, body);
        return reply.code(201).send({ data: classSession });
      } catch (error: any) {
        app.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message || 'Failed to create online class' }],
        });
      }
    }
  );

  app.get(
    '/classes',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      const status = (request.query as any)?.status;
      const classes = await listLecturerClasses(user.id, status);
      return { data: classes };
    }
  );

  app.get(
    '/classes/:sessionId',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      try {
        const { sessionId } = request.params as { sessionId: string };
        const details = await getClassDetails(sessionId, user.id);
        return { data: details };
      } catch (error: any) {
        app.log.error(error);
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: error.message || 'Class not found' }],
        });
      }
    }
  );

  app.post(
    '/classes/:sessionId/regenerate-qr',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      try {
        const { sessionId } = request.params as { sessionId: string };
        const classSession = await regenerateQrCode(sessionId, user.id);
        return { data: classSession };
      } catch (error: any) {
        app.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message || 'Failed to regenerate QR code' }],
        });
      }
    }
  );

  app.get(
    '/classes/:sessionId/qr-code',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      try {
        const { sessionId } = request.params as { sessionId: string };
        const qrData = await getQrCodeData(sessionId, user.id);
        return { data: qrData };
      } catch (error: any) {
        app.log.error(error);
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: error.message || 'QR code not found' }],
        });
      }
    }
  );

  app.post(
    '/classes/:sessionId/start',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      try {
        const { sessionId } = request.params as { sessionId: string };
        const classSession = await startClass(sessionId, user.id);
        return { data: classSession };
      } catch (error: any) {
        app.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message || 'Failed to start class' }],
        });
      }
    }
  );

  app.post(
    '/classes/:sessionId/close',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }],
        });
      }

      try {
        const { sessionId } = request.params as { sessionId: string };
        const classSession = await closeClass(sessionId, user.id);
        return { data: classSession };
      } catch (error: any) {
        app.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message || 'Failed to close class' }],
        });
      }
    }
  );

  // Student routes
  app.get(
    '/classes/student/my-classes',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('STUDENT')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Student access required' }],
        });
      }

      const classes = await listStudentClasses(user.id);
      return { data: classes };
    }
  );

  app.post(
    '/classes/scan-qr',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('STUDENT')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Student access required' }],
        });
      }

      try {
        const body = scanQrSchema.parse(request.body);
        const result = await scanQrAttendance(user.id, body.qrData);
        if (result.success) {
          return { data: result };
        } else {
          return reply.code(400).send({
            errors: [{ code: 'BAD_REQUEST', message: result.message }],
          });
        }
      } catch (error: any) {
        app.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message || 'Failed to scan QR code' }],
        });
      }
    }
  );

  app.post(
    '/classes/enter-code',
    { preHandler: authGuard },
    async (request, reply) => {
      const user = request.authUser;
      if (!user?.roles.includes('STUDENT')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Student access required' }],
        });
      }

      try {
        const body = enterCodeSchema.parse(request.body);
        const result = await enterAttendanceCode(user.id, body.sessionId, body.code);
        if (result.success) {
          return { data: result };
        } else {
          return reply.code(400).send({
            errors: [{ code: 'BAD_REQUEST', message: result.message }],
          });
        }
      } catch (error: any) {
        app.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'BAD_REQUEST', message: error.message || 'Failed to enter attendance code' }],
        });
      }
    }
  );
};

