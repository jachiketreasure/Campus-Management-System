import { env } from './config/env';
import { buildServer } from './server';

async function start() {
  const app = await buildServer();

  const port = env.PORT;
  const host = env.HOST;

  try {
    await app.listen({ port, host });
    app.log.info(`API server listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();

