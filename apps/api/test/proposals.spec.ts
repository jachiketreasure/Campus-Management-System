import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

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

describe('Proposals routes (demo store)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NEXTAUTH_USE_PRISMA = 'false';
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows student to create proposal for gig', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/proposals',
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        gigId: 'demo-gig-1',
        message: 'I can deliver this in 5 days with high quality design mockups.',
        amount: 50000,
        deliveryTimeDays: 5
      }
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json<{ data: { id: string; status: string } }>();
    expect(payload.data.status).toBe('PENDING');
  });

  it('lists proposals for a gig', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/proposals/demo-gig-1'
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ data: Array<{ gigId: string }> }>();
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it('allows lecturer to accept a proposal and create order', async () => {
    const proposalsResponse = await app.inject({
      method: 'GET',
      url: '/proposals/demo-gig-1'
    });

    const proposals = proposalsResponse.json<{ data: Array<{ id: string }> }>().data;
    const proposalId = proposals[0]?.id;
    expect(proposalId).toBeDefined();

    const acceptResponse = await app.inject({
      method: 'POST',
      url: '/proposals/accept',
      headers: {
        authorization: `Bearer ${lecturerToken}`
      },
      payload: {
        proposalId,
        buyerId: 'demo-lecturer'
      }
    });

    expect(acceptResponse.statusCode).toBe(201);
    const order = acceptResponse.json<{ data: { status: string; buyerId: string } }>().data;
    expect(order.status).toBe('IN_PROGRESS');
    expect(order.buyerId).toBe('demo-lecturer');
  });

  it('lists orders for current user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/proposals/orders/me',
      headers: {
        authorization: `Bearer ${lecturerToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json<{ data: Array<{ status: string }> }>();
    expect(payload.data.some((order) => order.status === 'IN_PROGRESS')).toBe(true);
  });
});

