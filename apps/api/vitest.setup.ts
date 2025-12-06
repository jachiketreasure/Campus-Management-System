process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '4000';
process.env.HOST = process.env.HOST ?? '127.0.0.1';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'test-nextauth-secret';
process.env.NEXTAUTH_DEMO_ENABLED = process.env.NEXTAUTH_DEMO_ENABLED ?? 'true';
process.env.NEXTAUTH_DEMO_PASSWORD = process.env.NEXTAUTH_DEMO_PASSWORD ?? 'ChangeMe123!';
process.env.NEXTAUTH_USE_PRISMA = process.env.NEXTAUTH_USE_PRISMA ?? 'false';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/test';

