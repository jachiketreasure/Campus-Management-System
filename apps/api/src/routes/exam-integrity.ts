import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import { prisma } from '@cms/database';
import {
  createExamIntegrity,
  getExamIntegrity,
  listExamIntegrityForLecturer,
  listExamIntegrityForReview,
  listApprovedExamIntegrityForCourse,
  updateExamIntegrityStatus,
  createExamAttempt,
  getExamAttempt,
  listExamAttemptsForStudent,
  listExamAttemptsForExam,
  listExamAttemptsForLecturer,
  updateExamAttempt,
  listExamNotificationsForUser,
  markNotificationAsSeen,
  createVisitor,
  getVisitorByEmail,
  verifyVisitorPassword,
  updateVisitorLastLogin,
  listVisitors,
  updateVisitor,
  deleteVisitor,
  getExamQuestionsForStudent,
  getExamQuestionsForLecturer,
} from '../services/exam-integrity-service';

const createExamSchema = z.object({
  title: z.string().min(3),
  courseCode: z.string().min(1),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(['MCQ', 'Theory']),
    question: z.string(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.union([z.string(), z.number()]).optional(),
    marks: z.number().min(1),
  })),
  duration: z.number().min(1),
  allowedAttempts: z.number().min(1),
  startDate: z.string(),
  endDate: z.string(),
  accessCode: z.string().min(1),
});

const updateExamStatusSchema = z.object({
  status: z.enum(['PENDING_ADMIN_REVIEW', 'APPROVED', 'DECLINED', 'NEEDS_REVIEW']),
  reviewNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

const createAttemptSchema = z.object({
  examId: z.string(),
});

const updateAttemptSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'ABANDONED']).optional(),
  score: z.number().optional(),
  answers: z.any().optional(),
  endTime: z.string().optional(),
});

const createVisitorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  visitorType: z.string(),
  phone: z.string().optional(),
  registrationNumber: z.string().optional(),
});

const updateVisitorSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  visitorType: z.string().optional(),
  status: z.string().optional(),
  phone: z.string().optional(),
  registrationNumber: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const examIntegrityRoutes: FastifyPluginAsync = async (app) => {
  // Simple auth check - in production, use proper auth middleware
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    
    if (!userId) {
      return reply.code(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'User ID required' }]
      });
    }
    
    (request as any).userId = userId;
    (request as any).userRole = userRole;
    done();
  };

  // Exam Integrity Routes
  app.post('/exams', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const body = createExamSchema.parse(request.body);
      
      const exam = await createExamIntegrity({
        lecturerId: userId,
        title: body.title,
        courseCode: body.courseCode,
        questions: body.questions,
        duration: body.duration,
        allowedAttempts: body.allowedAttempts,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        accessCode: body.accessCode,
      });

      return reply.code(201).send({ data: exam });
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/exams/lecturer/:lecturerId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ lecturerId: z.string() }).parse(request.params);
      const exams = await listExamIntegrityForLecturer(params.lecturerId);
      return { data: exams };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/exams/review', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userRole = (request as any).userRole;
      if (userRole !== 'ADMIN') {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }
      
      const exams = await listExamIntegrityForReview();
      return { data: exams };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/exams/course/:courseCode', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ courseCode: z.string() }).parse(request.params);
      const exams = await listApprovedExamIntegrityForCourse(params.courseCode);
      return { data: exams };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/exams/:examId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const userRole = (request as any).userRole;
      const params = z.object({ examId: z.string() }).parse(request.params);
      const exam = await getExamIntegrity(params.examId);
      
      if (!exam) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Exam not found' }]
        });
      }
      
      // Remove correct answers from questions if user is not the lecturer who created the exam
      if (userRole !== 'LECTURER' || exam.lecturerId !== userId) {
        const questionsWithoutAnswers = await getExamQuestionsForStudent(params.examId);
        return { 
          data: {
            ...exam,
            questions: questionsWithoutAnswers
          }
        };
      }

      // Lecturer can see correct answers for their own exams
      const questionsWithAnswers = await getExamQuestionsForLecturer(params.examId, userId);
      return { 
        data: {
          ...exam,
          questions: questionsWithAnswers
        }
      };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.put('/exams/:examId/status', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userRole = (request as any).userRole;
      if (userRole !== 'ADMIN') {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }
      
      const params = z.object({ examId: z.string() }).parse(request.params);
      const body = updateExamStatusSchema.parse(request.body);
      const userId = (request as any).userId;
      
      const exam = await updateExamIntegrityStatus(params.examId, userId, body);
      return { data: exam };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Exam Attempt Routes
  app.post('/attempts', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const body = createAttemptSchema.parse(request.body);
      
      const attempt = await createExamAttempt(body.examId, userId);
      return reply.code(201).send({ data: attempt });
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/attempts/student/:studentId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const attempts = await listExamAttemptsForStudent(params.studentId);
      return { data: attempts };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/attempts/exam/:examId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const userRole = (request as any).userRole;
      
      // Only lecturers can view attempts for their exams
      if (userRole !== 'LECTURER') {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }]
        });
      }

      const params = z.object({ examId: z.string() }).parse(request.params);
      
      // Verify the lecturer owns this exam
      const exam = await prisma.examIntegrity.findUnique({
        where: { id: params.examId },
        select: { lecturerId: true },
      });

      if (!exam) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Exam not found' }]
        });
      }

      if (exam.lecturerId !== userId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'You can only view attempts for your own exams' }]
        });
      }

      const attempts = await listExamAttemptsForExam(params.examId);
      return { data: attempts };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/attempts/lecturer/:lecturerId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const params = z.object({ lecturerId: z.string() }).parse(request.params);
      
      // Verify the lecturer is viewing their own attempts
      if (userId !== params.lecturerId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'You can only view your own exam attempts' }]
        });
      }

      const attempts = await listExamAttemptsForLecturer(params.lecturerId);
      return { data: attempts };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/attempts/:attemptId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ attemptId: z.string() }).parse(request.params);
      const attempt = await getExamAttempt(params.attemptId);
      
      if (!attempt) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Attempt not found' }]
        });
      }
      
      return { data: attempt };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.put('/attempts/:attemptId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ attemptId: z.string() }).parse(request.params);
      const body = updateAttemptSchema.parse(request.body);
      
      const updateData: any = { ...body };
      if (body.endTime) {
        updateData.endTime = new Date(body.endTime);
      }
      
      const attempt = await updateExamAttempt(params.attemptId, updateData);
      return { data: attempt };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Notification Routes
  app.get('/notifications/:userId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ userId: z.string() }).parse(request.params);
      const notifications = await listExamNotificationsForUser(params.userId);
      return { data: notifications };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.put('/notifications/:notificationId/seen', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ notificationId: z.string() }).parse(request.params);
      const notification = await markNotificationAsSeen(params.notificationId);
      return { data: notification };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Visitor/User Management Routes
  app.post('/visitors', async (request, reply) => {
    try {
      const body = createVisitorSchema.parse(request.body);
      const visitor = await createVisitor(body);
      return reply.code(201).send({ data: visitor });
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.post('/visitors/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // Fast path: get visitor and verify
      const visitor = await getVisitorByEmail(body.email);
      
      if (!visitor) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Invalid email or password' }]
        });
      }
      
      const isValid = await verifyVisitorPassword(visitor, body.password);
      
      if (!isValid) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Invalid email or password' }]
        });
      }
      
      if (visitor.status !== 'ACTIVE') {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Account is not active' }]
        });
      }
      
      // Update last login asynchronously - don't block response
      updateVisitorLastLogin(visitor.id);
      
      // Return visitor without password hash immediately
      const { passwordHash, ...visitorData } = visitor;
      return { data: visitorData };
    } catch (error: any) {
      // Only log actual errors, not auth failures
      if (error.code !== 'UNAUTHORIZED' && error.code !== 'FORBIDDEN') {
        request.log.error({ err: error }, 'Login error');
      }
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.get('/visitors', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userRole = (request as any).userRole;
      const userId = (request as any).userId;
      
      request.log.info({ userRole, userId }, 'Listing visitors request');
      
      // Case-insensitive role check
      if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
        request.log.warn({ userRole }, 'Access denied - not admin');
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }
      
      // Get all visitors from database - no filtering by creator
      // This returns ALL visitors regardless of who created them
      const visitors = await listVisitors();
      
      request.log.info({ count: visitors.length }, 'Retrieved visitors from database');
      
      // Password hash is already excluded in listVisitors() select, so just return visitors
      return { data: visitors };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error listing visitors');
      
      // Provide user-friendly error messages for connection issues
      let errorMessage = error.message || 'Failed to retrieve visitors';
      let statusCode = 500;
      
      if (error.message?.includes('connection') || 
          error.message?.includes('I/O error') ||
          error.message?.includes('forcibly closed')) {
        errorMessage = 'Database connection error. Please try again in a moment.';
        statusCode = 503; // Service Unavailable
      }
      
      return reply.code(statusCode).send({
        errors: [{ code: 'DATABASE_ERROR', message: errorMessage }]
      });
    }
  });

  app.get('/visitors/:visitorId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ visitorId: z.string() }).parse(request.params);
      const visitor = await prisma.visitor.findUnique({
        where: { id: params.visitorId },
      });
      
      if (!visitor) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Visitor not found' }]
        });
      }
      
      const { passwordHash, ...visitorData } = visitor;
      return { data: visitorData };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.put('/visitors/:visitorId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userId = (request as any).userId;
      const userRole = (request as any).userRole;
      const params = z.object({ visitorId: z.string() }).parse(request.params);
      const body = updateVisitorSchema.parse(request.body);
      
      // Allow students to update only their own registration number
      if (userRole && userRole.toUpperCase() === 'STUDENT') {
        if (params.visitorId !== userId) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: 'You can only update your own information' }]
          });
        }
        // Students can only update registration number
        const allowedFields = ['registrationNumber'];
        const bodyKeys = Object.keys(body).filter(key => body[key as keyof typeof body] !== undefined);
        const hasOnlyAllowedFields = bodyKeys.every(key => allowedFields.includes(key));
        
        if (!hasOnlyAllowedFields || bodyKeys.length === 0) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: 'Students can only update their registration number' }]
          });
        }
      } else if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
        // Non-admin, non-student users are not allowed
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }
      
      const visitor = await updateVisitor(params.visitorId, body);
      const { passwordHash, ...visitorData } = visitor;
      return { data: visitorData };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  app.delete('/visitors/:visitorId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const userRole = (request as any).userRole;
      // Case-insensitive role check
      if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
        });
      }
      
      const params = z.object({ visitorId: z.string() }).parse(request.params);
      await deleteVisitor(params.visitorId);
      return { data: { success: true } };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });
};

