import jwt from 'jsonwebtoken';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server';
import type { FastifyInstance } from 'fastify';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies access when no token is provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me'
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns user info when a valid token is provided', async () => {
    const token = jwt.sign(
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

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ user: unknown }>();
    expect(payload.user).toMatchObject({
      id: 'demo-admin',
      email: 'admin@example.edu',
      roles: ['ADMIN']
    });
  });
});

