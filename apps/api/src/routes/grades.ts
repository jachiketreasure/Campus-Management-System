import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import { prisma } from '@cms/database';
import {
  getOrCreateCourseGrade,
  getStudentGrades,
  getCourseGrades,
  updateCourseGrade,
  recalculateAttendance
} from '../services/grade-service';
import { calculateSemesterGPA, calculateCGPA } from '../services/gpa-service';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

const updateGradeSchema = z.object({
  testScore: z.coerce.number().min(0).max(10).optional(),
  examScore: z.coerce.number().min(0).max(70).optional(),
  notes: z.string().optional()
});

export const gradesRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  // Get student's grades
  app.get(
    '/student/:studentId',
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
        studentId: z.string(),
        sessionId: z.string().optional(),
        semester: z.string().optional()
      }).parse({ ...(request.params as any), ...(request.query as any) });

      // Students can only view their own grades
      if (params.studentId !== user.id && !user.roles?.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'You can only view your own grades' }]
        });
      }

      const grades = await getStudentGrades(
        params.studentId,
        params.sessionId,
        params.semester
      );

      return { data: grades };
    }
  );

  // Get course grades (lecturer view)
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
      }).parse({ ...(request.params as any), ...(request.query as any) });

      // Only lecturers and admins can view course grades
      if (!user.roles?.includes('LECTURER') && !user.roles?.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Only lecturers can view course grades' }]
        });
      }

      const grades = await getCourseGrades(params.courseId, params.sessionId, params.semester);
      return { data: grades };
    }
  );

  // Get or create grade for enrollment
  app.get(
    '/enrollment/:enrollmentId',
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

      const params = z.object({ enrollmentId: z.string() }).parse(request.params);

      // Get enrollment to verify access
      if (usePrismaStore) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { id: params.enrollmentId },
          include: {
            course: true,
            student: true
          }
        });

        if (!enrollment) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Enrollment not found' }]
          });
        }

        // Students can only view their own grades
        if (enrollment.studentId !== user.id && !user.roles?.includes('ADMIN') && !user.roles?.includes('LECTURER')) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
          });
        }

        // Get session and semester from course assignment
        const assignment = await prisma.lecturerCourseAssignment.findFirst({
          where: {
            courseId: enrollment.courseId
          },
          orderBy: { createdAt: 'desc' }
        });

        if (!assignment) {
          return reply.code(400).send({
            errors: [{ code: 'BAD_REQUEST', message: 'Course not assigned to a session/semester' }]
          });
        }

        const grade = await getOrCreateCourseGrade(
          params.enrollmentId,
          enrollment.courseId,
          enrollment.studentId,
          assignment.sessionId,
          assignment.semester
        );

        return { data: grade };
      }

      return reply.code(500).send({
        errors: [{ code: 'INTERNAL_ERROR', message: 'Database not available' }]
      });
    }
  );

  // Update grade (lecturer only)
  app.patch(
    '/:gradeId',
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

      if (!user.roles?.includes('LECTURER') && !user.roles?.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Only lecturers can update grades' }]
        });
      }

      const params = z.object({ gradeId: z.string() }).parse(request.params);
      const body = updateGradeSchema.parse(request.body);

      try {
        const grade = await updateCourseGrade(params.gradeId, user.id, body);
        if (!grade) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Grade not found' }]
          });
        }

        return { data: grade };
      } catch (error) {
        if (error instanceof Error && (error as { statusCode?: number }).statusCode === 400) {
          return reply.code(400).send({
            errors: [{ code: 'BAD_REQUEST', message: error.message }]
          });
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to update grade' }]
        });
      }
    }
  );

  // Recalculate attendance
  app.post(
    '/:gradeId/recalculate-attendance',
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

      const params = z.object({ gradeId: z.string() }).parse(request.params);

      const grade = await recalculateAttendance(params.gradeId);
      if (!grade) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Grade not found' }]
        });
      }

      return { data: grade };
    }
  );

  // Calculate semester GPA
  app.get(
    '/student/:studentId/gpa',
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
        studentId: z.string(),
        sessionId: z.string(),
        semester: z.string()
      }).parse({ ...(request.params as any), ...(request.query as any) });

      if (params.studentId !== user.id && !user.roles?.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const gpa = await calculateSemesterGPA(params.studentId, params.sessionId, params.semester);
      return { data: gpa };
    }
  );

  // Calculate CGPA
  app.get(
    '/student/:studentId/cgpa',
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

      const params = z.object({ studentId: z.string() }).parse(request.params);

      if (params.studentId !== user.id && !user.roles?.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const cgpa = await calculateCGPA(params.studentId);
      return { data: cgpa };
    }
  );
};

