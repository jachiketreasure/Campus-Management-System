import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction
} from 'fastify';
import { z } from 'zod';
import { getStudentResultData, generateResultPDFHTML } from '../services/pdf-service';

export const pdfResultsRoutes: FastifyPluginAsync = async (app) => {
  const authGuard = (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    app
      .authenticate(request, reply)
      .then(() => done())
      .catch(done);
  };

  // Generate PDF result for student
  app.get(
    '/student/:studentId/result',
    {
      preHandler: authGuard
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return reply.code(401).send({
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
      }

      const params = z.object({
        studentId: z.string(),
        sessionId: z.string().optional()
      }).parse({ ...(request.params as any), ...(request.query as any) });

      // Students can only view their own results
      if (params.studentId !== user.id && !user.roles?.includes('ADMIN')) {
        return reply.code(403).send({
          errors: [{ code: 'FORBIDDEN', message: 'You can only view your own results' }]
        });
      }

      try {
        const data = await getStudentResultData(params.studentId, params.sessionId);
        const html = generateResultPDFHTML(data);

        // Return HTML for now - in production, use puppeteer or similar to generate PDF
        reply.type('text/html');
        return html;
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({
          errors: [{ code: 'INTERNAL_ERROR', message: 'Failed to generate result' }]
        });
      }
    }
  );
};

