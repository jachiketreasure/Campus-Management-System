import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  createExamSession,
  getConsentStatus,
  getExamSession,
  listExamSessions,
  recordConsent,
  // Exam Content Management
  createExamContent,
  submitExamContent,
  listExamContentsForReview,
  reviewExamContent,
  getExamContentBySession,
  // Student Verification
  getOrCreateStudentVerification,
  updateStudentVerification,
  // Monitoring
  createMonitoringSession,
  getActiveMonitoringSessions,
  createMonitoringEvent,
  getMonitoringEvents,
  reviewMonitoringEvent
} from '../services/exam-service';

const createExamSchema = z.object({
  courseId: z.string(),
  title: z.string().min(3),
  scheduledStart: z.string(),
  scheduledEnd: z.string().optional(),
  proctoringEnabled: z.boolean().optional(),
  consentRequired: z.boolean().optional()
});

const consentSchema = z.object({
  consented: z.boolean()
});

// Exam Content Management Schemas
const createExamContentSchema = z.object({
  examSessionId: z.string(),
  title: z.string().min(3),
  content: z.string(),
  attachments: z.array(z.string()).optional()
});

const reviewExamContentSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'REQUIRES_CHANGES']),
  reviewNotes: z.string().optional(),
  rejectionReason: z.string().optional()
});

// Student Verification Schemas
const updateVerificationSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'VERIFIED', 'FAILED', 'EXPIRED']).optional(),
  idDocumentUrl: z.string().optional(),
  idVerified: z.boolean().optional(),
  faceImageUrl: z.string().optional(),
  faceVerified: z.boolean().optional(),
  cameraAccess: z.boolean().optional(),
  verificationNotes: z.string().optional()
});

// Monitoring Schemas
const createMonitoringEventSchema = z.object({
  monitoringSessionId: z.string(),
  eventType: z.enum(['MULTIPLE_FACES', 'LOOKING_AWAY', 'UNAUTHORIZED_DEVICE', 'SUSPICIOUS_AUDIO', 'TAB_SWITCH', 'COPY_PASTE', 'EXTERNAL_DEVICE', 'NETWORK_ISSUE', 'MANUAL_FLAG']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string(),
  confidenceScore: z.number().min(0).max(1)
});

const reviewMonitoringEventSchema = z.object({
  reviewNotes: z.string().optional()
});

export const examsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  app.post(
    '/',
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

      const body = createExamSchema.parse(request.body);
      const exam = await createExamSession(user.id, body);

      return reply.code(201).send({ data: exam });
    }
  );

  app.get(
    '/',
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

      const exams = await listExamSessions(user.id);
      return { data: exams };
    }
  );

  app.post('/:examId/consent', async (request, reply) => {
    const params = z.object({ examId: z.string() }).parse(request.params);
    const body = consentSchema.parse(request.body);

    const studentId =
      request.authUser?.id ||
      (typeof request.headers['x-student-id'] === 'string' ? request.headers['x-student-id'] : null);

    if (!studentId) {
      return reply.code(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Student identifier required' }]
      });
    }

    const exam = await getExamSession(params.examId);
    if (!exam) {
      return reply.code(404).send({
        errors: [{ code: 'NOT_FOUND', message: 'Exam session not found' }]
      });
    }

    const consent = await recordConsent(params.examId, studentId, body.consented, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return reply.code(201).send({ data: consent });
  });

  app.get('/:examId/consent/me', async (request, reply) => {
    const params = z.object({ examId: z.string() }).parse(request.params);

    const studentId =
      request.authUser?.id ||
      (typeof request.headers['x-student-id'] === 'string' ? request.headers['x-student-id'] : null);

    if (!studentId) {
      return reply.code(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'Student identifier required' }]
      });
    }

    const consent = await getConsentStatus(params.examId, studentId);
    if (!consent) {
      return reply.code(404).send({
        errors: [{ code: 'NOT_FOUND', message: 'Consent record not found' }]
      });
    }

    return { data: consent };
  });

  // Exam Content Management Routes
  app.post('/content', {
    preHandler: authGuard
  }, async (request, reply) => {
    const user = request.authUser;

    if (!user?.roles.includes('LECTURER')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }]
      });
    }

    const body = createExamContentSchema.parse(request.body);
    const content = await createExamContent(user.id, body);

    return reply.code(201).send({ data: content });
  });

  app.put('/content/:contentId/submit', {
    preHandler: authGuard
  }, async (request, reply) => {
    const params = z.object({ contentId: z.string() }).parse(request.params);
    const user = request.authUser;

    if (!user?.roles.includes('LECTURER')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }]
      });
    }

    const content = await submitExamContent(params.contentId, user.id);
    return { data: content };
  });

  app.get('/content/review', {
    preHandler: authGuard
  }, async (request, reply) => {
    const user = request.authUser;

    if (!user?.roles.includes('ADMIN')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
      });
    }

    const contents = await listExamContentsForReview();
    return { data: contents };
  });

  // Get exam content for a specific exam session (for students)
  // This route must come after /content/review but before other /:examId routes
  app.get('/:examId/content', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ examId: z.string() }).parse(request.params);
      const user = request.authUser;

      // Allow students to access approved exam content
      if (!user?.roles.includes('STUDENT') && !user?.roles.includes('ADMIN') && !user?.roles.includes('LECTURER')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const content = await getExamContentBySession(params.examId);
      if (!content) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Exam content not found for this exam session' }]
        });
      }

      // Only return approved content to students
      if (user?.roles.includes('STUDENT') && content.status !== 'APPROVED') {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Exam content is not available yet' }]
        });
      }

      return { data: content };
    } catch (error) {
      console.error('Error in /:examId/content route:', error);
      return reply.code(500).send({
        errors: [{ code: 'INTERNAL_ERROR', message: 'Failed to fetch exam content' }]
      });
    }
  });

  app.put('/content/:contentId/review', {
    preHandler: authGuard
  }, async (request, reply) => {
    const params = z.object({ contentId: z.string() }).parse(request.params);
    const body = reviewExamContentSchema.parse(request.body);
    const user = request.authUser;

    if (!user?.roles.includes('ADMIN')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
      });
    }

    const content = await reviewExamContent(params.contentId, user.id, body);
    return { data: content };
  });

  // Student Verification Routes
  app.get('/:examId/verification/me', {
    preHandler: authGuard
  }, async (request, reply) => {
    const params = z.object({ examId: z.string() }).parse(request.params);
    const user = request.authUser;

    if (!user?.roles.includes('STUDENT')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Student access required' }]
      });
    }

    const verification = await getOrCreateStudentVerification(params.examId, user.id);
    return { data: verification };
  });

  app.put('/verification/:verificationId', {
    preHandler: authGuard
  }, async (request, reply) => {
    const params = z.object({ verificationId: z.string() }).parse(request.params);
    const body = updateVerificationSchema.parse(request.body);
    const user = request.authUser;

    // Allow both students and admins to update verification
    if (!user?.roles.includes('STUDENT') && !user?.roles.includes('ADMIN')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
      });
    }

    const verification = await updateStudentVerification(params.verificationId, body);
    return { data: verification };
  });

  // Monitoring Routes
  app.post('/monitoring', {
    preHandler: authGuard
  }, async (request, reply) => {
    const user = request.authUser;
    const body = z.object({
      examSessionId: z.string(),
      studentId: z.string().optional()
    }).parse(request.body);

    if (!user?.roles.includes('ADMIN') && !user?.roles.includes('LECTURER')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin or Lecturer access required' }]
      });
    }

    const session = await createMonitoringSession(body.examSessionId, user.id, body.studentId);
    return reply.code(201).send({ data: session });
  });

  app.get('/monitoring/active', {
    preHandler: authGuard
  }, async (request, reply) => {
    const user = request.authUser;
    const query = z.object({
      examSessionId: z.string().optional()
    }).parse(request.query);

    if (!user?.roles.includes('ADMIN') && !user?.roles.includes('LECTURER')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin or Lecturer access required' }]
      });
    }

    const sessions = await getActiveMonitoringSessions(query.examSessionId);
    return { data: sessions };
  });

  app.post('/monitoring/events', {
    preHandler: authGuard
  }, async (request, reply) => {
    const user = request.authUser;
    const body = createMonitoringEventSchema.parse(request.body);

    if (!user?.roles.includes('ADMIN') && !user?.roles.includes('LECTURER')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin or Lecturer access required' }]
      });
    }

    const event = await createMonitoringEvent(body);
    return reply.code(201).send({ data: event });
  });

  app.get('/monitoring/events', {
    preHandler: authGuard
  }, async (request, reply) => {
    const user = request.authUser;
    const query = z.object({
      monitoringSessionId: z.string().optional(),
      examSessionId: z.string().optional(),
      reviewed: z.string().transform(val => val === 'true').optional()
    }).parse(request.query);

    if (!user?.roles.includes('ADMIN') && !user?.roles.includes('LECTURER')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin or Lecturer access required' }]
      });
    }

    const events = await getMonitoringEvents(
      query.monitoringSessionId,
      query.examSessionId,
      query.reviewed
    );
    return { data: events };
  });

  app.put('/monitoring/events/:eventId/review', {
    preHandler: authGuard
  }, async (request, reply) => {
    const params = z.object({ eventId: z.string() }).parse(request.params);
    const body = reviewMonitoringEventSchema.parse(request.body);
    const user = request.authUser;

    if (!user?.roles.includes('ADMIN') && !user?.roles.includes('LECTURER')) {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin or Lecturer access required' }]
      });
    }

    const event = await reviewMonitoringEvent(params.eventId, user.id, body.reviewNotes);
    return { data: event };
  });
};

