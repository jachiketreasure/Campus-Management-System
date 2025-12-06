import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

type AuthTokenPayload = {
  id?: string;
  sub?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  [key: string]: unknown;
};

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      roles: string[];
    };
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const decorateAuthenticate = (app: FastifyInstance) =>
  app.decorate(
    'authenticate',
    async function authenticate(
      this: FastifyInstance,
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      if (!request.authUser) {
        reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required'
        });
        return;
      }
    }
  );

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('authUser', null as unknown as FastifyRequest['authUser']);
  decorateAuthenticate(app);

  app.addHook('preHandler', async (request) => {
    const bearerToken = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null;

    const cookieToken =
      request.cookies?.['next-auth.session-token'] ??
      request.cookies?.['__Secure-next-auth.session-token'] ??
      null;

    const token = bearerToken ?? cookieToken;

    if (!token) {
      return;
    }

    try {
      const decoded = jwt.verify(token, env.NEXTAUTH_SECRET) as AuthTokenPayload;
      const roles = Array.isArray(decoded.roles)
        ? decoded.roles.filter((role): role is string => typeof role === 'string')
        : [];

      const id =
        (typeof decoded.id === 'string' && decoded.id) ||
        (typeof decoded.sub === 'string' && decoded.sub) ||
        undefined;
      if (!id) {
        request.log.warn('JWT missing user identifier');
        return;
      }

      request.authUser = {
        id,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        roles
      };
    } catch (error) {
      request.log.debug({ err: error }, 'Failed to verify auth token');
    }
  });
});

