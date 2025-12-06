const { config } = require('dotenv');
const { existsSync } = require('fs');
const path = require('path');

// Find .env file in project root
const findProjectRoot = () => {
  let currentDir = __dirname;
  // Go up from scripts/db-push.js -> database -> packages -> root
  for (let i = 0; i < 4; i++) {
    const envPath = path.resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback to process.cwd() and check parent
  const cwd = process.cwd();
  const cwdEnv = path.resolve(cwd, '.env');
  if (existsSync(cwdEnv)) {
    return cwd;
  }
  const parentEnv = path.resolve(cwd, '..', '.env');
  if (existsSync(parentEnv)) {
    return path.dirname(cwd);
  }
  return cwd;
};

const projectRoot = findProjectRoot();
const rootEnvPath = path.resolve(projectRoot, '.env');
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
  console.log(`✅ Loaded .env from: ${rootEnvPath}`);
} else {
  console.error(`❌ .env file not found. Expected at: ${rootEnvPath}`);
  process.exit(1);
}

// Now run prisma db push
const { execSync } = require('child_process');
const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const isWindows = process.platform === 'win32';
const prismaCmd = isWindows ? 'npx prisma' : path.resolve(__dirname, '../node_modules/.bin/prisma');

try {
  console.log('🔄 Pushing database schema...');
  const command = isWindows 
    ? `npx prisma db push --schema="${schemaPath}"`
    : `"${prismaCmd}" db push --schema="${schemaPath}"`;
  
  execSync(command, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    shell: isWindows
  });
  console.log('✅ Database schema pushed successfully!');
} catch (error) {
  console.error('❌ Failed to push database schema');
  process.exit(1);
}

