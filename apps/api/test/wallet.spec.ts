import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

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

describe('Wallet routes (demo store)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NEXTAUTH_USE_PRISMA = 'false';
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns wallet summary for authenticated user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wallet',
      headers: {
        authorization: `Bearer ${studentToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ data: { userId: string; balance: number } }>();
    expect(payload.data.userId).toBe('demo-student');
  });

  it('lists wallet transactions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/wallet/transactions',
      headers: {
        authorization: `Bearer ${studentToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ data: Array<{ type: string }> }>();
    expect(Array.isArray(payload.data)).toBe(true);
  });

  it('allows admin to release escrow', async () => {
    const releaseResponse = await app.inject({
      method: 'POST',
      url: '/wallet/release',
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: { orderId: 'non-existing' }
    });

    expect(releaseResponse.statusCode === 200 || releaseResponse.statusCode === 404).toBe(true);
  });

  it('allows user to create dispute', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/wallet/disputes',
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        orderId: 'demo-order',
        description: 'Funds not released as expected.'
      }
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json<{ data: { status: string } }>();
    expect(payload.data.status).toBe('OPEN');
  });
});

