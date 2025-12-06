import type { FastifyPluginAsync } from 'fastify';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request, reply) => {
    await app.authenticate(request, reply);
  });

  app.get('/me', async (request) => ({
    status: 'ok',
    user: request.authUser
  }));
};

