import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Load environment variables FIRST
const findProjectRoot = (): string => {
  let currentDir = __dirname;
  for (let i = 0; i < 5; i++) {
    const envPath = path.resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
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
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@example.edu';
const ADMIN_PASSWORD = 'ChangeMe123!';
const ADMIN_NAME = 'System Administrator';

async function createOriginalAdmin() {
  console.log('🔧 Creating/Restoring original admin account...\n');

  try {
    // Check if it already exists
    const existing = await prisma.visitor.findUnique({
      where: { email: ADMIN_EMAIL }
    });

    if (existing) {
      console.log(`Found existing account: ${ADMIN_EMAIL}`);
      console.log(`   Current role: ${existing.visitorType}`);
      console.log(`   Current status: ${existing.status}\n`);

      // Update to ADMIN
      const updated = await prisma.visitor.update({
        where: { email: ADMIN_EMAIL },
        data: {
          visitorType: 'ADMIN' as any,
          status: 'ACTIVE',
          name: ADMIN_NAME
        }
      });

      console.log('✅ Admin account restored!');
      console.log(`   Email: ${updated.email}`);
      console.log(`   Name: ${updated.name}`);
      console.log(`   Role: ${updated.visitorType}`);
      console.log(`   Status: ${updated.status}`);
    } else {
      // Create new admin account
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

      const admin = await prisma.visitor.create({
        data: {
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          passwordHash,
          visitorType: 'ADMIN' as any,
          status: 'ACTIVE'
        }
      });

      console.log('✅ Original admin account created!');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.name}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      console.log(`   Role: ${admin.visitorType}`);
      console.log(`   Status: ${admin.status}`);
    }

    console.log('\n📝 You can now log in with:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('   Email already exists. Use restore script instead.');
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

createOriginalAdmin();

