import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import {
  getAllActiveLecturers,
  getCoursesWithAssignments,
  assignLecturerToCourse,
  removeLecturerAssignment,
  getCourseAssignments,
} from '../services/admin-course-assignment-service';

const assignmentSchema = z.object({
  courseId: z.string().min(1),
  sessionId: z.string().min(1),
  semester: z.string().min(1),
  lecturerId: z.string().min(1, 'A lecturer must be selected'),
});

export const adminCourseAssignmentRoutes: FastifyPluginAsync = async (app) => {
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
    done();
  };

  // Get all active lecturers
  app.get('/admin/lecturers', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const lecturers = await getAllActiveLecturers();
      return { data: lecturers };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching lecturers');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get courses with assignments for a session
  app.get('/admin/courses/assignments', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const query = z.object({
        sessionId: z.string().min(1),
        semester: z.string().optional(),
      }).parse(request.query);

      const courses = await getCoursesWithAssignments(query.sessionId, query.semester);
      return { data: courses };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching courses with assignments');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Assign lecturer to a course (only one lecturer per course)
  app.post('/admin/courses/assign-lecturer', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const body = assignmentSchema.parse(request.body);
      
      await assignLecturerToCourse(
        body.courseId,
        body.sessionId,
        body.semester,
        body.lecturerId
      );
      
      return reply.code(200).send({ 
        message: 'Lecturer assigned successfully',
        data: { courseId: body.courseId, lecturerId: body.lecturerId }
      });
    } catch (error: any) {
      request.log.error({ err: error }, 'Error assigning lecturer');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Remove lecturer assignment
  app.delete('/admin/courses/assignments/:assignmentId', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ assignmentId: z.string() }).parse(request.params);
      
      await removeLecturerAssignment(params.assignmentId);
      
      return reply.code(200).send({ message: 'Assignment removed successfully' });
    } catch (error: any) {
      request.log.error({ err: error }, 'Error removing assignment');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get assignments for a specific course
  app.get('/admin/courses/:courseId/assignments', {
    preHandler: adminGuard
  }, async (request, reply) => {
    try {
      const params = z.object({ courseId: z.string() }).parse(request.params);
      const query = z.object({
        sessionId: z.string().min(1),
        semester: z.string().optional(),
      }).parse(request.query);

      const assignments = await getCourseAssignments(params.courseId, query.sessionId, query.semester);
      return { data: assignments };
    } catch (error: any) {
      request.log.error({ err: error }, 'Error fetching course assignments');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });
};












