import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import { prisma } from '@cms/database';
import {
  getStudentRegistration,
  saveStudentRegistration,
  getStudentCourses,
  getAvailableCourses,
  getRequiredCourses,
  getRequiredCoursesForStudent,
  checkInitialRegistrationComplete,
  saveInitialStudentRegistration,
} from '../services/student-registration-service';

const registrationSchema = z.object({
  sessionId: z.string().min(1),
  registrationNumber: z.string().min(1),
  academicLevel: z.string().min(1),
  courseIds: z.array(z.string()).min(1),
});

const initialRegistrationSchema = z.object({
  // Personal Information
  sex: z.string().min(1),
  dateOfBirth: z.string(),
  stateOfOrigin: z.string().min(1),
  lgaOfOrigin: z.string().min(1),
  homeTown: z.string().min(1),
  permanentAddress: z.string().min(1),
  mobileNumber: z.string().min(1),
  contactAddress: z.string().min(1),
  bloodGroup: z.string().min(1),
  genotype: z.string().min(1),
  religion: z.string().min(1),
  email: z.string().email(),
  // Sponsor Details
  sponsorFullName: z.string().min(1),
  sponsorAddress: z.string().min(1),
  sponsorMobileNumber: z.string().min(1),
  sponsorEmail: z.string().email(),
  sponsorRelationship: z.string().min(1),
  // Next of Kin Details
  nextOfKinFullName: z.string().min(1),
  nextOfKinAddress: z.string().min(1),
  nextOfKinMobileNumber: z.string().min(1),
  nextOfKinEmail: z.string().email(),
  nextOfKinRelationship: z.string().min(1),
  // Programme Details
  department: z.string().min(1),
  programmeType: z.string().min(1),
  programme: z.string().min(1),
  modeOfEntry: z.string().min(1),
  entryYear: z.string().min(1),
  yearOfGraduation: z.string().min(1),
  yearOfStudy: z.string().min(1),
  // Passport Photo
  passportPhotoUrl: z.string().min(1),
});

export const studentRegistrationRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = async (request: FastifyRequest, reply: FastifyReply) => {
    // Try NextAuth authentication first (if available)
    // The auth plugin hook should have populated request.authUser if a token exists
    if (request.authUser) {
      const userRoles = request.authUser.roles?.map((r: string) => r.toUpperCase()) ?? [];
      if (!userRoles.includes('STUDENT')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Student access required' }]
        });
      }
      (request as any).userId = request.authUser.id;
      (request as any).userRole = 'STUDENT';
      (request as any).studentId = request.authUser.id;
      return;
    }

    // Fallback to header-based authentication (for visitors)
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
  };

  // Get student registration
  app.get('/students/:studentId/registration', {
    preHandler: [authGuard]
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const studentId = (request as any).studentId;

      // Ensure student can only access their own registration
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const registration = await getStudentRegistration(studentId);
      
      if (!registration) {
        return reply.code(404).send({
          errors: [{ code: 'NOT_FOUND', message: 'Registration not found' }]
        });
      }

      return { data: registration };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Save student registration
  app.post('/students/:studentId/registration', {
    preHandler: [authGuard]
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const body = registrationSchema.parse(request.body);
      const studentId = (request as any).studentId;

      // Ensure student can only update their own registration
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      // Try to get visitor info from request body or headers if available
      const visitorInfo = {
        email: (request.body as any)?.email || request.headers['x-user-email'] as string,
        name: (request.body as any)?.name || request.headers['x-user-name'] as string,
      };

      const registration = await saveStudentRegistration(studentId, body, visitorInfo);
      return reply.code(201).send({ data: registration });
    } catch (error: any) {
      request.log.error({ err: error, studentId: (request as any).studentId }, 'Error saving student registration');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get student courses
  app.get('/students/:studentId/courses', {
    preHandler: [authGuard]
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const studentId = (request as any).studentId;

      // Ensure student can only access their own courses
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const courses = await getStudentCourses(studentId);
      return { data: courses };
    } catch (error: any) {
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get available courses (optionally filtered by level, semester, and session)
  // This endpoint is public - no auth required for browsing courses
  app.get('/courses', async (request, reply) => {
    try {
      const query = z.object({ 
        level: z.string().optional(),
        semester: z.string().optional(),
        sessionId: z.string().optional()
      }).parse(request.query);
      
      request.log.info({ query }, 'Fetching courses with filters');
      
      const courses = await getAvailableCourses(query.level, query.semester, query.sessionId);
      
      request.log.info({ count: (courses as any[]).length, level: query.level, semester: query.semester, sessionId: query.sessionId }, 'Courses fetched successfully');
      
      return { data: courses };
    } catch (error: any) {
      request.log.error({ err: error, query: request.query }, 'Error fetching courses');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get required courses for a specific level and semester
  // This endpoint is public - no auth required
  app.get('/courses/required', async (request, reply) => {
    try {
      const query = z.object({ 
        level: z.string().min(1),
        semester: z.string().min(1)
      }).parse(request.query);
      
      const courses = await getRequiredCourses(query.level, query.semester);
      
      return { data: courses };
    } catch (error: any) {
      request.log.error({ err: error, query: request.query }, 'Error fetching required courses');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Get required courses for a student by registration number
  // This endpoint requires student authentication
  app.get('/students/:studentId/required-courses', {
    preHandler: [authGuard]
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const query = z.object({ 
        registrationNumber: z.string().optional(),
        level: z.string().optional()
      }).parse(request.query);
      
      const studentId = (request as any).studentId;

      // Ensure student can only access their own required courses
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      // Get registration number from query or from student record
      let registrationNumber = query.registrationNumber;
      
      if (!registrationNumber) {
        const student = await prisma.visitor.findUnique({
          where: { id: studentId },
          select: { registrationNumber: true }
        });
        
        if (!student?.registrationNumber) {
          return reply.code(400).send({
            errors: [{ code: 'BAD_REQUEST', message: 'Registration number is required' }]
          });
        }
        
        registrationNumber = student.registrationNumber;
      }

      const requiredCourses = await getRequiredCoursesForStudent(registrationNumber || '', query.level || '');
      
      return { data: requiredCourses };
    } catch (error: any) {
      request.log.error({ err: error, studentId: (request as any).studentId }, 'Error fetching required courses for student');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });

  // Check if student has completed initial registration
  app.get('/students/:studentId/initial-registration-status', {
    preHandler: [authGuard]
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const studentId = (request as any).studentId;

      // Ensure student can only access their own status
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const isComplete = await checkInitialRegistrationComplete(studentId);
      return { data: { isComplete } };
    } catch (error: any) {
      request.log.error({ err: error, studentId: (request as any).studentId }, 'Error checking initial registration status');
      // Return false on error instead of throwing - this allows the frontend to proceed
      return { data: { isComplete: false } };
    }
  });

  // Save initial student registration
  app.post('/students/:studentId/initial-registration', {
    preHandler: [authGuard]
  }, async (request, reply) => {
    try {
      const params = z.object({ studentId: z.string() }).parse(request.params);
      const body = initialRegistrationSchema.parse(request.body);
      const studentId = (request as any).studentId;

      // Ensure student can only update their own registration
      if (params.studentId !== studentId) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'Access denied' }]
        });
      }

      const result = await saveInitialStudentRegistration(studentId, body);
      return reply.code(201).send({ data: result });
    } catch (error: any) {
      request.log.error({ err: error, studentId: (request as any).studentId }, 'Error saving initial student registration');
      return reply.code(400).send({
        errors: [{ code: 'BAD_REQUEST', message: error.message }]
      });
    }
  });
};

