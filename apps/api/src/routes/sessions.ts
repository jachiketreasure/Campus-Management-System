import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  getAvailableSessions,
  getStudentSessionRegistration,
  getStudentSessionRegistrationBySession,
  registerForSession,
  getAllSessions,
  createSession,
  updateSession,
  deleteSession,
  getAllSessionRegistrations,
  approveSessionRegistration,
  rejectSessionRegistration,
  verifyPayment,
  type CreateSessionInput,
  type UpdateSessionInput,
} from '../services/session-service';

const registerSessionSchema = z.object({
  sessionId: z.string(),
  paymentReference: z.string().optional(),
});

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    
    if (!userId) {
      return reply.code(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'User ID required' }]
      });
    }

    if (!userRole || userRole.toUpperCase() !== 'STUDENT') {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Student access required' }]
      });
    }
    
    (request as any).userId = userId;
    (request as any).userRole = userRole;
    (request as any).studentId = userId;
    done();
  };

  // Get available sessions (public endpoint)
  app.get('/sessions', async (request, reply) => {
    try {
      const sessions = await getAvailableSessions();
      return { data: sessions };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching sessions');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get student's current session registration
  app.get('/students/:studentId/session', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const studentId = (request as any).studentId;

      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const registration = await getStudentSessionRegistration(studentId);
      
      if (!registration) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'No active session registration found' }]
        });
      }

      return { data: registration };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching student session');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get student's session registration by session ID
  app.get('/students/:studentId/session/:sessionId', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ 
        studentId: z.string(),
        sessionId: z.string()
      }).parse(request.params);
      const studentId = (request as any).studentId;

      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const registration = await getStudentSessionRegistrationBySession(studentId, params.sessionId);
      
      if (!registration) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'No registration found for this session' }]
        });
      }

      return { data: registration };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching student session by session ID');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Register for a session
  app.post('/students/:studentId/session', {
    preHandler: authGuard
  }, async (request, reply) => {
    let body: any = null;
    let studentId: string | undefined;
    
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      body = registerSessionSchema.parse(request.body);
      studentId = (request as any).studentId;

      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const registration = await registerForSession(studentId, body.sessionId, body.paymentReference);
      return reply.code(201).send({ data: registration });
    } catch (error: any) {
      // Log full error details
      request.log.error({ 
        err: error, 
        studentId: studentId || 'unknown', 
        sessionId: body?.sessionId || 'unknown',
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code,
        errorMeta: error.meta,
        requestBody: request.body,
      }, 'Error registering for session');
      
      // Determine appropriate status code
      const statusCode = error.message?.includes('not found') || 
                        error.message?.includes('not available') ||
                        error.message?.includes('not open') ||
                        error.message?.includes('validation') ||
                        error.name === 'ZodError'
                        ? 400 // Bad request for validation errors
                        : 500; // Server error for unexpected errors
      
      // Return detailed error message
      let errorMessage = error.message || 'Failed to register for session';
      
      // If it's a Zod validation error, format it nicely
      if (error.name === 'ZodError' && error.errors) {
        errorMessage = `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
      }
      
      return reply.code(statusCode).send({
        errors: [{ 
          code: statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR', 
          message: errorMessage,
          // Include additional error details in development
          ...(process.env.NODE_ENV !== 'production' && {
            details: {
              code: error.code,
              meta: error.meta,
              name: error.name,
            }
          })
        }]
      });
    }
  });

  // Admin routes
  const adminGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    
    if (!userId) {
      return reply.code(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'User ID required' }]
      });
    }

    if (!userRole || userRole.toUpperCase() !== 'ADMIN') {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Admin access required' }]
      });
    }
    
    (request as any).userId = userId;
    (request as any).userRole = userRole;
    (request as any).adminId = userId;
    done();
  };

  // Get all sessions (admin)
  app.get('/admin/sessions', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const sessions = await getAllSessions();
      return { data: sessions };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching all sessions');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Create session (admin)
  app.post('/admin/sessions', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const body = z.object({
        name: z.string().min(1),
        startDate: z.string(),
        endDate: z.string(),
        status: z.enum(['PENDING', 'ACTIVE', 'CLOSED', 'CANCELLED']).optional(),
        requiresPayment: z.boolean().optional(),
        paymentAmount: z.number().optional(),
        paymentCurrency: z.string().optional(),
        isActive: z.boolean().optional(),
        registrationOpen: z.boolean().optional(),
      }).parse(request.body);

      const session = await createSession(body);
      return reply.code(201).send({ data: session });
    } catch (error: any) {
      request.log.error({ err: error }, 'Error creating session');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Update session (admin)
  app.put('/admin/sessions/:sessionId', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ sessionId: z.string() }).parse(request.params);
      const body = z.object({
        name: z.string().min(1).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(['PENDING', 'ACTIVE', 'CLOSED', 'CANCELLED']).optional(),
        requiresPayment: z.boolean().optional(),
        paymentAmount: z.number().optional(),
        paymentCurrency: z.string().optional(),
        isActive: z.boolean().optional(),
        registrationOpen: z.boolean().optional(),
      }).parse(request.body);

      const session = await updateSession(params.sessionId, body);
      return { data: session };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error updating session');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Delete session (admin)
  app.delete('/admin/sessions/:sessionId', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ sessionId: z.string() }).parse(request.params);
      await deleteSession(params.sessionId);
      return { data: { success: true } };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error deleting session');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get all session registrations (admin)
  app.get('/admin/session-registrations', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const query = z.object({
        sessionId: z.string().optional(),
        status: z.string().optional(),
      }).parse(request.query);

      const registrations = await getAllSessionRegistrations(query.sessionId, query.status);
      return { data: registrations };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching session registrations');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Approve session registration (admin)
  app.post('/admin/session-registrations/:registrationId/approve', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ registrationId: z.string() }).parse(request.params);
      const body = z.object({
        notes: z.string().optional(),
      }).parse(request.body);
      const adminId = (request as any).adminId;

      const registration = await approveSessionRegistration(params.registrationId, adminId, body.notes);
      return { data: registration };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error approving registration');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Reject session registration (admin)
  app.post('/admin/session-registrations/:registrationId/reject', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ registrationId: z.string() }).parse(request.params);
      const body = z.object({
        notes: z.string().optional(),
      }).parse(request.body);
      const adminId = (request as any).adminId;

      const registration = await rejectSessionRegistration(params.registrationId, adminId, body.notes);
      return { data: registration };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error rejecting registration');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Verify payment (admin)
  app.post('/admin/session-registrations/:registrationId/verify-payment', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ registrationId: z.string() }).parse(request.params);
      const body = z.object({
        notes: z.string().optional(),
      }).parse(request.body);
      const adminId = (request as any).adminId;

      const registration = await verifyPayment(params.registrationId, adminId, body.notes);
      return { data: registration };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error verifying payment');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });
};

