import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  getStudentCurrentLevelInfo,
  getStudentLevelHistory,
  assignStudentToLevelSession,
} from '../services/student-progression-service';
import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';

const updateLevelSchema = z.object({
  level: z.string().min(1).regex(/^\d+L$/i, 'Level must be in format like 100L, 200L, etc.'),
  sessionId: z.string().min(1),
});

const updateCourseSchema = z.object({
  courseOfStudy: z.string().min(1),
});

const updateLevelAndCourseSchema = z.object({
  level: z.string().min(1).regex(/^\d+L$/i, 'Level must be in format like 100L, 200L, etc.'),
  sessionId: z.string().min(1),
  courseOfStudy: z.string().min(1),
});

export const studentSettingsRoutes: FastifyPluginAsync = async (app) => {
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

  // Get student's current level and session info
  app.get('/students/:studentId/level-info', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const studentId = (request as any).studentId;

      // Ensure student can only access their own info
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const info = await getStudentCurrentLevelInfo(studentId);
      
      if (!info) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Student level information not found' }]
        });
      }

      return { data: info };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get student's level history
  app.get('/students/:studentId/level-history', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const studentId = (request as any).studentId;

      // Ensure student can only access their own history
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const history = await getStudentLevelHistory(studentId);
      return { data: history };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Update student's level and session
  app.put('/students/:studentId/level', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const body = updateLevelSchema.parse(request.body);
      const studentId = (request as any).studentId;

      // Ensure student can only update their own level
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      // Verify session exists
      const session = await retryDbOperation(() =>
        prisma.academicSession.findUnique({
          where: { id: body.sessionId },
        })
      );

      if (!session) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Session not found' }]
        });
      }

      // Get student's current cohort session (preserve it)
      const student = await retryDbOperation(() =>
        prisma.visitor.findUnique({
          where: { id: studentId },
          select: { cohortSessionId: true },
        })
      );

      // Assign student to new level and session
      await assignStudentToLevelSession(
        studentId,
        body.level,
        body.sessionId,
        student?.cohortSessionId || body.sessionId
      );

      const updatedInfo = await getStudentCurrentLevelInfo(studentId);
      return { data: updatedInfo };
    } catch (error: any) {
      request.log.error({ err: error, studentId: (request as any).studentId }, 'Error updating student level');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Update student's course of study
  app.put('/students/:studentId/course', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const body = updateCourseSchema.parse(request.body);
      const studentId = (request as any).studentId;

      // Ensure student can only update their own course
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      // Update course of study
      await retryDbOperation(() =>
        prisma.visitor.update({
          where: { id: studentId },
          data: {
            courseOfStudy: body.courseOfStudy,
          },
        })
      );

      const updatedInfo = await getStudentCurrentLevelInfo(studentId);
      return { data: updatedInfo };
    } catch (error: any) {
      request.log.error({ err: error, studentId: (request as any).studentId }, 'Error updating student course');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Update both level and course of study
  app.put('/students/:studentId/level-and-course', {
    preHandler: authGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const body = updateLevelAndCourseSchema.parse(request.body);
      const studentId = (request as any).studentId;

      // Ensure student can only update their own info
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      // Verify session exists
      const session = await retryDbOperation(() =>
        prisma.academicSession.findUnique({
          where: { id: body.sessionId },
        })
      );

      if (!session) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Session not found' }]
        });
      }

      // Get student's current cohort session (preserve it)
      const student = await retryDbOperation(() =>
        prisma.visitor.findUnique({
          where: { id: studentId },
          select: { cohortSessionId: true },
        })
      );

      // Update both level/session and course of study
      await Promise.all([
        assignStudentToLevelSession(
          studentId,
          body.level,
          body.sessionId,
          student?.cohortSessionId || body.sessionId
        ),
        retryDbOperation(() =>
          prisma.visitor.update({
            where: { id: studentId },
            data: {
              courseOfStudy: body.courseOfStudy,
            },
          })
        ),
      ]);

      const updatedInfo = await getStudentCurrentLevelInfo(studentId);
      return { data: updatedInfo };
    } catch (error: any) {
      request.log.error({ err: error, studentId: (request as any).studentId }, 'Error updating student level and course');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });
};















