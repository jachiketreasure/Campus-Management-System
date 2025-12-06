import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  getAvailableCoursesForAssignment,
  getLecturerAssignedCourses,
  assignLecturerToCourse,
  removeLecturerAssignment,
  getCourseLecturer,
  verifyLecturerAssignment,
} from '../services/lecturer-course-assignment-service';

const assignmentSchema = z.object({
  courseId: z.string().min(1),
  sessionId: z.string().min(1),
  semester: z.string().min(1),
  notes: z.string().optional(),
});

export const lecturerCourseAssignmentRoutes: FastifyPluginAsync = async (app) => {
  const lecturerGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const userId = request.headers['x-user-id'] as string;
    const userRole = request.headers['x-user-role'] as string;
    
    if (!userId) {
      return reply.code(401).send({
        errors: [{ code: 'UNAUTHORIZED', message: 'User ID required' }]
      });
    }

    if (!userRole || userRole.toUpperCase() !== 'LECTURER') {
      return reply.code(403).send({
        errors: [{ code: 'FORBIDDEN', message: 'Lecturer access required' }]
      });
    }
    
    (request as any).userId = userId;
    (request as any).userRole = userRole;
    (request as any).lecturerId = userId;
    done();
  };

  // Get available courses for assignment (for lecturers)
  app.get('/lecturers/:lecturerId/available-courses', {
    preHandler: lecturerGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ lecturerId: z.string() }).parse(request.params);
      const query = z.object({
        sessionId: z.string().min(1),
        semester: z.string().optional(),
      }).parse(request.query);
      
      const lecturerId = (request as any).lecturerId;

      // Ensure lecturer can only access their own data
      if (params.lecturerId !== lecturerId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const courses = await getAvailableCoursesForAssignment(query.sessionId, query.semester);
      
      return { data: courses };
    } catch (error: any) {
      request.log.error({ err: error, lecturerId: (request as any).lecturerId }, 'Error fetching available courses');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get courses assigned to lecturer
  app.get('/lecturers/:lecturerId/assigned-courses', {
    preHandler: lecturerGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ lecturerId: z.string() }).parse(request.params);
      const query = z.object({
        sessionId: z.string().min(1),
        semester: z.string().optional(),
      }).parse(request.query);
      
      const lecturerId = (request as any).lecturerId;

      // Ensure lecturer can only access their own data
      if (params.lecturerId !== lecturerId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const assignments = await getLecturerAssignedCourses(lecturerId, query.sessionId, query.semester);
      
      return { data: assignments };
    } catch (error: any) {
      request.log.error({ err: error, lecturerId: (request as any).lecturerId }, 'Error fetching assigned courses');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Assign lecturer to a course
  app.post('/lecturers/:lecturerId/course-assignments', {
    preHandler: lecturerGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ lecturerId: z.string() }).parse(request.params);
      const body = assignmentSchema.parse(request.body);
      const lecturerId = (request as any).lecturerId;

      // Ensure lecturer can only assign themselves
      if (params.lecturerId !== lecturerId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const assignment = await assignLecturerToCourse(
        lecturerId,
        body.courseId,
        body.sessionId,
        body.semester,
        body.notes
      );
      
      return reply.code(201).send({ data: assignment });
    } catch (error: any) {
      request.log.error({ err: error, lecturerId: (request as any).lecturerId }, 'Error assigning course');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Remove lecturer assignment
  app.delete('/lecturers/:lecturerId/course-assignments/:assignmentId', {
    preHandler: lecturerGuard
  }, async (request, reply) => {
    try {
      const params = z.object({
        lecturerId: z.string(),
        assignmentId: z.string(),
      }).parse(request.params);
      
      const lecturerId = (request as any).lecturerId;

      // Ensure lecturer can only remove their own assignments
      if (params.lecturerId !== lecturerId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      await removeLecturerAssignment(params.assignmentId, lecturerId);
      
      return reply.code(200).send({ message: 'Assignment removed successfully' });
    } catch (error: any) {
      request.log.error({ err: error, lecturerId: (request as any).lecturerId }, 'Error removing assignment');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get lecturer for a course (public endpoint for students)
  app.get('/courses/:courseId/lecturer', async (request, reply) => {
    try {
      const params = z.object({ courseId: z.string() }).parse(request.params);
      const query = z.object({
        sessionId: z.string().min(1),
        semester: z.string().min(1),
      }).parse(request.query);

      const lecturer = await getCourseLecturer(params.courseId, query.sessionId, query.semester);
      
      if (!lecturer) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'No lecturer assigned to this course for the specified semester' }]
        });
      }
      
      return { data: lecturer };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching course lecturer');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Verify lecturer assignment (for attendance/exam creation)
  app.get('/lecturers/:lecturerId/verify-assignment', {
    preHandler: lecturerGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ lecturerId: z.string() }).parse(request.params);
      const query = z.object({
        courseId: z.string().min(1),
        sessionId: z.string().min(1),
        semester: z.string().min(1),
      }).parse(request.query);
      
      const lecturerId = (request as any).lecturerId;

      // Ensure lecturer can only verify their own assignments
      if (params.lecturerId !== lecturerId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const isAssigned = await verifyLecturerAssignment(
        lecturerId,
        query.courseId,
        query.sessionId,
        query.semester
      );
      
      return { data: { isAssigned } };
    } catch (error: any) {
      request.log.error({ err: error, lecturerId: (request as any).lecturerId }, 'Error verifying assignment');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });
};












