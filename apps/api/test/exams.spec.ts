import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { buildServer } from '../src/server';

const lecturerToken = jwt.sign(
  {
    id: 'demo-lecturer',
    email: 'lecturer@example.edu',
    firstName: 'Demo',
    lastName: 'Lecturer',
    roles: ['LECTURER']
  },
  process.env.NEXTAUTH_SECRET!,
  { expiresIn: '1h' }
);

describe('Exam routes (demo mode)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NEXTAUTH_USE_PRISMA = 'false';
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows lecturer to create exam session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/exams',
      headers: {
        authorization: `Bearer ${lecturerToken}`
      },
      payload: {
        courseId: 'course-csc401',
        title: 'Final Exam',
        scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      }
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json<{ data: { id: string } }>();
    expect(payload.data.id).toBeDefined();
  });

  it('rejects exam creation for non-lecturer', async () => {
    const studentToken = jwt.sign(
      {
        id: 'demo-student',
        email: 'student@example.edu',
        firstName: 'Demo',
        lastName: 'Student',
        roles: ['STUDENT']
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '1h' }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/exams',
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        courseId: 'course-csc401',
        title: 'Unauthorized Exam',
        scheduledStart: new Date().toISOString()
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it('lists exams for lecturer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/exams',
      headers: {
        authorization: `Bearer ${lecturerToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ data: Array<{ lecturerId: string }> }>();
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it('records student consent for exam session', async () => {
    const examList = await app.inject({
      method: 'GET',
      url: '/exams',
      headers: {
        authorization: `Bearer ${lecturerToken}`
      }
    });

    const examId = examList.json<{ data: Array<{ id: string }> }>().data[0]?.id ?? 'demo-exam-1';

    const consentResponse = await app.inject({
      method: 'POST',
      url: `/exams/${examId}/consent`,
      headers: {
        'x-student-id': 'demo-student'
      },
      payload: {
        consented: true
      }
    });

    expect(consentResponse.statusCode).toBe(201);
    const consentPayload = consentResponse.json<{ data: { consented: boolean } }>();
    expect(consentPayload.data.consented).toBe(true);

    const fetchConsent = await app.inject({
      method: 'GET',
      url: `/exams/${examId}/consent/me`,
      headers: {
        'x-student-id': 'demo-student'
      }
    });

    expect(fetchConsent.statusCode).toBe(200);
    const fetched = fetchConsent.json<{ data: { studentId: string; consented: boolean } }>();
    expect(fetched.data.studentId).toBe('demo-student');
    expect(fetched.data.consented).toBe(true);
  });

  it('returns 401 when student identifier missing', async () => {
    const examList = await app.inject({
      method: 'GET',
      url: '/exams',
      headers: {
        authorization: `Bearer ${lecturerToken}`
      }
    });

    const examId = examList.json<{ data: Array<{ id: string }> }>().data[0]?.id ?? 'demo-exam-1';

    const response = await app.inject({
      method: 'POST',
      url: `/exams/${examId}/consent`,
      payload: { consented: true }
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 404 when consent record missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/exams/non-existent/consent/me',
      headers: {
        'x-student-id': 'demo-student'
      }
    });

    expect(response.statusCode).toBe(404);
  });
});

