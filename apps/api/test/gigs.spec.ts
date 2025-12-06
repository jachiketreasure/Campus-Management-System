import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

const adminToken = jwt.sign(
  {
    id: 'demo-admin',
    email: 'admin@example.edu',
    firstName: 'Demo',
    lastName: 'Admin',
    roles: ['ADMIN']
  },
  process.env.NEXTAUTH_SECRET!,
  { expiresIn: '1h' }
);

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

describe('Gigs routes (demo store)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NEXTAUTH_USE_PRISMA = 'false';
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists gigs without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/gigs'
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ data: unknown[]; meta: { total: number } }>();
    expect(payload.data.length).toBeGreaterThan(0);
    expect(payload.meta.total).toBeGreaterThan(0);
  });

  it('creates a gig for authenticated user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/gigs',
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        title: 'Lecture Note Summaries',
        description: 'Summarize lecture notes into digestible study pointers.',
        category: 'Writing',
        price: 25000,
        deliveryTimeDays: 3,
        tags: ['writing', 'summary']
      }
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json<{ data: { id: string; ownerId: string } }>();
    expect(payload.data.ownerId).toBe('demo-student');
  });

  it('updates a gig when owner provides valid token', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/gigs',
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        title: 'Campus Analytics Dashboard',
        description: 'Build dashboard widgets for attendance and gig metrics.',
        category: 'Analytics',
        price: 80000,
        deliveryTimeDays: 10,
        tags: ['analytics', 'dashboard']
      }
    });

    const createdGig = createResponse.json<{ data: { id: string } }>().data;

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/gigs/${createdGig.id}`,
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        status: 'PAUSED',
        price: 85000
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json<{ data: { status: string; price: number } }>().data;
    expect(updated.status).toBe('PAUSED');
    expect(updated.price).toBe(85000);
  });

  it('prevents non-owner from updating gig', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/gigs/demo-gig-1',
      headers: {
        authorization: `Bearer ${adminToken}` // admin is allowed
      },
      payload: {
        status: 'PAUSED'
      }
    });

    expect(response.statusCode).toBe(200);

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

    const forbiddenResponse = await app.inject({
      method: 'PATCH',
      url: '/gigs/demo-gig-1',
      headers: {
        authorization: `Bearer ${lecturerToken}`
      },
      payload: {
        status: 'COMPLETED'
      }
    });

    expect(forbiddenResponse.statusCode).toBe(403);
  });
});

