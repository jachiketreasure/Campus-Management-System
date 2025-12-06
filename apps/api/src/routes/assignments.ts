import type { FastifyPluginAsync, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { z } from 'zod';
import {
  getLecturerAssignments,
  getCourseAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentSubmissions,
  gradeSubmission,
  returnGradedAssignment,
  getStudentAssignments,
  getStudentGradedAssignments,
  getStudentMissedAssignments,
  submitAssignment,
  type CreateAssignmentInput,
  type UpdateAssignmentInput,
} from '../services/assignment-service';

const createAssignmentSchema = z.object({
  courseId: z.string(),
  sessionId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  dueDate: z.string(),
  maxScore: z.number().min(0).max(1000).optional(),
  attachments: z.array(z.string()).optional(),
});

const updateAssignmentSchema = createAssignmentSchema.partial().extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
});

const gradeSubmissionSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(0),
  feedback: z.string().optional(),
});

const submitAssignmentSchema = z.object({
  content: z.string().optional(),
  attachments: z.array(z.string()).optional().default([]),
});

export const assignmentsRoutes: FastifyPluginAsync = async (app) => {
  const lecturerGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    
    // Check Visitor-based auth first (for admin-created users)
    if (userId && userRole?.toUpperCase() === 'LECTURER') {
      (request as any).lecturerId = userId;
      done();
      return;
    }
    
    // Try NextAuth authentication as fallback
    app
      .authenticate(request, reply)
      .then(() => {
        const user = request.authUser;
        // If NextAuth user exists and has LECTURER role, allow
        if (user && user.roles?.includes('LECTURER')) {
          (request as any).lecturerId = user.id;
          done();
          return;
        }
        
        // No valid authentication
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
        });
      })
      .catch(() => {
        // If NextAuth fails and no Visitor auth, reject
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
        });
      });
  };

  // Get all assignments for the authenticated lecturer
  app.get(
    '/lecturer',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lecturerId = (request as any).lecturerId;
      
      if (!lecturerId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Lecturer ID required' }],
        });
      }

      try {
        const assignments = await getLecturerAssignments(lecturerId);
        return { data: assignments };
      } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to get assignments' }],
        });
      }
    }
  );

  // Get assignments for a specific course
  app.get(
    '/course/:courseId',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = z.object({ courseId: z.string() }).parse(request.params);
      const query = z.object({ sessionId: z.string() }).parse(request.query);

      try {
        const assignments = await getCourseAssignments(params.courseId, query.sessionId);
        return { data: assignments };
      } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to get assignments' }],
        });
      }
    }
  );

  // Get a single assignment
  app.get(
    '/:assignmentId',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = z.object({ assignmentId: z.string() }).parse(request.params);

      try {
        const assignment = await getAssignmentById(params.assignmentId);
        if (!assignment) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Assignment not found' }],
          });
        }
        return { data: assignment };
      } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to get assignment' }],
        });
      }
    }
  );

  // Create a new assignment
  app.post(
    '/',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lecturerId = (request as any).lecturerId;
      
      if (!lecturerId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Lecturer ID required' }],
        });
      }
      const body = createAssignmentSchema.parse(request.body);

      try {
        const assignment = await createAssignment(lecturerId, body as CreateAssignmentInput);
        return reply.code(201).send({ data: assignment });
      } catch (error: any) {
        request.log.error(error);
        return reply.code(400).send({
          errors: [{ code: 'VALIDATION_ERROR', message: error.message || 'Failed to create assignment' }],
        });
      }
    }
  );

  // Update an assignment
  app.patch(
    '/:assignmentId',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lecturerId = (request as any).lecturerId;
      
      if (!lecturerId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Lecturer ID required' }],
        });
      }
      const params = z.object({ assignmentId: z.string() }).parse(request.params);
      const body = updateAssignmentSchema.parse(request.body);

      try {
        const assignment = await updateAssignment(params.assignmentId, lecturerId, body as UpdateAssignmentInput);
        return { data: assignment };
      } catch (error: any) {
        request.log.error(error);
        if (error.message.includes('Unauthorized') || error.message.includes('not found')) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: error.message }],
          });
        }
        return reply.code(400).send({
          errors: [{ code: 'VALIDATION_ERROR', message: error.message || 'Failed to update assignment' }],
        });
      }
    }
  );

  // Delete an assignment
  app.delete(
    '/:assignmentId',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lecturerId = (request as any).lecturerId;
      
      if (!lecturerId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Lecturer ID required' }],
        });
      }
      const params = z.object({ assignmentId: z.string() }).parse(request.params);

      try {
        await deleteAssignment(params.assignmentId, lecturerId);
        return reply.code(204).send();
      } catch (error: any) {
        request.log.error(error);
        if (error.message.includes('Unauthorized') || error.message.includes('not found')) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: error.message }],
          });
        }
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete assignment' }],
        });
      }
    }
  );

  // Get submissions for an assignment
  app.get(
    '/:assignmentId/submissions',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lecturerId = (request as any).lecturerId;
      
      if (!lecturerId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Lecturer ID required' }],
        });
      }
      const params = z.object({ assignmentId: z.string() }).parse(request.params);

      try {
        const submissions = await getAssignmentSubmissions(params.assignmentId, lecturerId);
        return { data: submissions };
      } catch (error: any) {
        request.log.error(error);
        if (error.message.includes('Unauthorized')) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: error.message }],
          });
        }
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to get submissions' }],
        });
      }
    }
  );

  // Grade a submission
  app.post(
    '/submissions/:submissionId/grade',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lecturerId = (request as any).lecturerId;
      
      if (!lecturerId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Lecturer ID required' }],
        });
      }
      const params = z.object({ submissionId: z.string() }).parse(request.params);
      const body = gradeSubmissionSchema.parse(request.body);

      try {
        const submission = await gradeSubmission(
          params.submissionId,
          lecturerId,
          body.score,
          body.maxScore,
          body.feedback
        );
        return { data: submission };
      } catch (error: any) {
        request.log.error(error);
        if (error.message.includes('Unauthorized')) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: error.message }],
          });
        }
        return reply.code(400).send({
          errors: [{ code: 'VALIDATION_ERROR', message: error.message || 'Failed to grade submission' }],
        });
      }
    }
  );

  // Return graded assignment to student
  app.post(
    '/submissions/:submissionId/return',
    { preHandler: lecturerGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const lecturerId = (request as any).lecturerId;
      
      if (!lecturerId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Lecturer ID required' }],
        });
      }
      const params = z.object({ submissionId: z.string() }).parse(request.params);

      try {
        const submission = await returnGradedAssignment(params.submissionId, lecturerId);
        return { data: submission };
      } catch (error: any) {
        request.log.error(error);
        if (error.message.includes('Unauthorized')) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: error.message }],
          });
        }
        return reply.code(400).send({
          errors: [{ code: 'VALIDATION_ERROR', message: error.message || 'Failed to return assignment' }],
        });
      }
    }
  );

  // Student routes
  const studentGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    
    // Check Visitor-based auth first (for admin-created users)
    if (userId && userRole?.toUpperCase() === 'STUDENT') {
      (request as any).studentId = userId;
      done();
      return;
    }
    
    // Try NextAuth authentication as fallback
    app
      .authenticate(request, reply)
      .then(() => {
        const user = request.authUser;
        // If NextAuth user exists and has STUDENT role, allow
        if (user && user.roles?.includes('STUDENT')) {
          (request as any).studentId = user.id;
          done();
          return;
        }
        
        // No valid authentication
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
        });
      })
      .catch(() => {
        // If NextAuth fails and no Visitor auth, reject
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
        });
      });
  };

  // Get assignments for the authenticated student
  app.get(
    '/student',
    { preHandler: studentGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const studentId = (request as any).studentId;
      
      if (!studentId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Student ID required' }],
        });
      }

      const query = z.object({ sessionId: z.string().optional() }).parse(request.query || {});

      try {
        request.log.info({ studentId, sessionId: query.sessionId }, 'Fetching student assignments');
        const assignments = await getStudentAssignments(studentId, query.sessionId);
        request.log.info({ studentId, count: assignments.length, withSubmissions: assignments.filter(a => a.studentSubmission).length }, 'Student assignments retrieved');
        return { data: assignments };
      } catch (error: any) {
        request.log.error({ err: error, studentId }, 'Error getting student assignments');
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to get assignments' }],
        });
      }
    }
  );

  // Get graded assignments for the authenticated student
  app.get(
    '/student/grades',
    { preHandler: studentGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const studentId = (request as any).studentId;
      
      if (!studentId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Student ID required' }],
        });
      }

      const query = z.object({ sessionId: z.string().optional() }).parse(request.query || {});

      try {
        const gradedAssignments = await getStudentGradedAssignments(studentId, query.sessionId);
        return { data: gradedAssignments };
      } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to get graded assignments' }],
        });
      }
    }
  );

  // Get missed assignments for the authenticated student
  app.get(
    '/student/missed',
    { preHandler: studentGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const studentId = (request as any).studentId;
      
      if (!studentId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Student ID required' }],
        });
      }

      const query = z.object({ sessionId: z.string().optional() }).parse(request.query || {});

      try {
        const missedAssignments = await getStudentMissedAssignments(studentId, query.sessionId);
        return { data: missedAssignments };
      } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: error.message || 'Failed to get missed assignments' }],
        });
      }
    }
  );

  // Submit an assignment
  app.post(
    '/:assignmentId/submit',
    { preHandler: studentGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const studentId = (request as any).studentId;
      
      if (!studentId) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Student ID required' }],
        });
      }
      const params = z.object({ assignmentId: z.string() }).parse(request.params);
      const body = submitAssignmentSchema.parse(request.body);

      try {
        request.log.info({ 
          studentId, 
          assignmentId: params.assignmentId,
          hasContent: !!body.content,
          attachmentsCount: body.attachments?.length || 0
        }, 'Submitting assignment');
        
        const submission = await submitAssignment(
          params.assignmentId,
          studentId,
          body.content,
          body.attachments || []
        );
        
        request.log.info({ 
          submissionId: submission.id,
          studentId,
          assignmentId: params.assignmentId
        }, 'Assignment submitted successfully');
        
        return reply.code(201).send({ data: submission });
      } catch (error: any) {
        request.log.error({ 
          err: error, 
          studentId, 
          assignmentId: params.assignmentId 
        }, 'Error submitting assignment');
        return reply.code(400).send({
          errors: [{ code: 'VALIDATION_ERROR', message: error.message || 'Failed to submit assignment' }],
        });
      }
    }
  );
};



