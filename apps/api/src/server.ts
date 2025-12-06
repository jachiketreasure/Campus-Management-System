import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import compress from '@fastify/compress';
import { env } from './config/env';
import { authPlugin } from './plugins/auth';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { gigsRoutes } from './routes/gigs';
import { proposalsRoutes } from './routes/proposals';
import { walletRoutes } from './routes/wallet';
import { attendanceRoutes } from './routes/attendance';
import { examsRoutes } from './routes/exams';
import { examIntegrityRoutes } from './routes/exam-integrity';
import { studentRegistrationRoutes } from './routes/student-registration';
import { studentSettingsRoutes } from './routes/student-settings';
import { sessionRoutes } from './routes/sessions';
import { lecturerCourseAssignmentRoutes } from './routes/lecturer-course-assignment';
import { adminCourseAssignmentRoutes } from './routes/admin-course-assignment';
import { assignmentsRoutes } from './routes/assignments';
import { registrationNumberRoutes } from './routes/registration-numbers';
import { aliveCheckRoutes } from './routes/alive-checks';
import { classSchedulingRoutes } from './routes/class-scheduling';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:standard' }
            }
    }
  });

  await app.register(cookie, {
    secret: env.NEXTAUTH_SECRET,
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax'
    }
  });

  // Enable compression for faster responses
  await app.register(compress, {
    global: true,
    encodings: ['gzip', 'deflate'],
    threshold: 1024 // Only compress responses larger than 1KB
  });

  await app.register(cors, {
    origin:
      env.CORS_ORIGIN === '*'
        ? true
        : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role', 'x-user-email', 'x-user-name']
  });

  await app.register(websocket);
  await app.register(authPlugin);
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(gigsRoutes, { prefix: '/gigs' });
  await app.register(proposalsRoutes, { prefix: '/proposals' });
  await app.register(walletRoutes, { prefix: '/wallet' });
  await app.register(attendanceRoutes, { prefix: '/attendance' });
  await app.register(examsRoutes, { prefix: '/exams' });
  await app.register(examIntegrityRoutes, { prefix: '/api' });
  await app.register(studentRegistrationRoutes, { prefix: '/api' });
  await app.register(studentSettingsRoutes, { prefix: '/api' });
  await app.register(sessionRoutes, { prefix: '/api' });
  await app.register(lecturerCourseAssignmentRoutes, { prefix: '/api' });
  await app.register(adminCourseAssignmentRoutes, { prefix: '/api' });
  await app.register(assignmentsRoutes, { prefix: '/api/assignments' });
  await app.register(registrationNumberRoutes, { prefix: '/api/registration-numbers' });
  await app.register(aliveCheckRoutes, { prefix: '/api/alive-checks' });
  await app.register(classSchedulingRoutes, { prefix: '/api' });

  app.get('/', async () => ({ status: 'ok' }));

  // Add caching headers for GET requests
  app.addHook('onSend', async (request, reply) => {
    if (request.method === 'GET' && !reply.getHeader('Cache-Control')) {
      // Cache static data for 5 minutes, dynamic data for 30 seconds
      const isStatic = request.url.includes('/health') || request.url.includes('/visitors');
      reply.header('Cache-Control', isStatic 
        ? 'public, max-age=300' 
        : 'public, max-age=30, must-revalidate'
      );
    }
  });

  return app;
}

