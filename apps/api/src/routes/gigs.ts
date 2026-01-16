import type { FastifyPluginAsync, FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { z } from 'zod';
import {
  createGig,
  getGigById,
  gigStatusValues,
  listGigs,
  updateGig
} from '../services/gig-service';

const gigStatusEnum = z.enum(gigStatusValues);

const listQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  status: gigStatusEnum.optional(),
  ownerId: z.string().optional(),
  page: z.coerce.number().int().positive().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

const gigBodySchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10),
  category: z.string().min(2),
  price: z.coerce.number().nonnegative(),
  currency: z.string().min(2).max(8).default('NGN').optional(),
  deliveryTimeDays: z.coerce.number().int().positive(),
  attachments: z.array(z.string().url()).optional().default([]),
  tags: z.array(z.string().min(1)).optional().default([]),
  status: gigStatusEnum.optional()
});

const updateGigSchema = gigBodySchema.partial();

export const gigsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  app.get('/', async (request) => {
    const query = listQuerySchema.parse(request.query);
    const gigs = await listGigs(query);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? gigs.length;
    const start = (page - 1) * pageSize;
    const paginated = gigs.slice(start, start + pageSize);

    return {
      data: paginated,
      meta: {
        total: gigs.length,
        page,
        pageSize
      }
    };
  });

  app.get('/:gigId', async (request, reply) => {
    const params = z.object({ gigId: z.string() }).parse(request.params);

    const gig = await getGigById(params.gigId);
    if (!gig) {
      return reply.code(404).send({
        errors: [{ code: 'NOT_FOUND', message: 'Gig not found' }]
      });
    }

    return { data: gig };
  });

  app.post(
    '/',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const body = gigBodySchema.parse(request.body);
      const user = request.authUser;

      if (!user) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
      }

      const gig = await createGig(user.id, body);
      return reply.code(201).send({ data: gig });
    }
  );

  app.patch(
    '/:gigId',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const params = z.object({ gigId: z.string() }).parse(request.params);
      const body = updateGigSchema.parse(request.body);
      const user = request.authUser;

      if (!user) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
      }

      try {
        const gig = await updateGig(params.gigId, user.id, user.roles ?? [], body);
        if (!gig) {
          return reply.code(404).send({
            errors: [{ code: 'NOT_FOUND', message: 'Gig not found' }]
          });
        }

        return { data: gig };
      } catch (error) {
        if (error instanceof Error && (error as unknown as { statusCode?: number }).statusCode === 403) {
          return reply.code(403).send({
            errors: [{ code: 'FORBIDDEN', message: 'Not allowed to update this gig' }]
          });
        }

        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Unable to update gig' }]
        });
      }
    }
  );
};

