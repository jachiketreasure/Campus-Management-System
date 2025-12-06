import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import { z } from 'zod';

// Find project root (go up from apps/api/src/config to root)
const findProjectRoot = (): string => {
  let currentDir = __dirname;
  // Go up from src/config/env.ts -> src/config -> src -> apps/api -> apps -> root
  for (let i = 0; i < 5; i++) {
    const envPath = path.resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback to process.cwd() or go up to find root
  currentDir = process.cwd();
  while (currentDir !== path.dirname(currentDir)) {
    const envPath = path.resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return process.cwd();
};

const projectRoot = findProjectRoot();
const rootEnvPath = path.resolve(projectRoot, '.env');
const serviceEnvPath = path.resolve(projectRoot, 'apps', 'api', '.env');

if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

if (existsSync(serviceEnvPath)) {
  config({ path: serviceEnvPath, override: true });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string(),
  NEXTAUTH_SECRET: z.string(),
  JWT_EXPIRATION: z.string().default('1h'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional()
});

export const env = envSchema.parse(process.env);

