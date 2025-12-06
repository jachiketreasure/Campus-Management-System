import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
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

async function restoreOriginalAdmin() {
  console.log('🔧 Restoring original admin access...\n');

  try {
    // List ALL visitors to see what we're working with
    console.log('📋 ALL VISITORS IN DATABASE:');
    const allVisitors = await prisma.visitor.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    if (allVisitors.length === 0) {
      console.log('   No visitors found in database.\n');
    } else {
      allVisitors.forEach((v, index) => {
        console.log(`   ${index + 1}. ${v.email}`);
        console.log(`      Name: ${v.name}`);
        console.log(`      Role: ${v.visitorType}`);
        console.log(`      Status: ${v.status}`);
        console.log(`      Created: ${v.createdAt}`);
        console.log('');
      });
    }

    // Check for admin@example.edu (original email)
    console.log('🔍 Checking for admin@example.edu...');
    let originalAdmin = await prisma.visitor.findUnique({
      where: { email: 'admin@example.edu' }
    });

    if (originalAdmin) {
      console.log(`✅ Found admin@example.edu!`);
      console.log(`   Current role: ${originalAdmin.visitorType}`);
      console.log(`   Current status: ${originalAdmin.status}\n`);

      if (originalAdmin.visitorType !== 'ADMIN') {
        const updated = await prisma.visitor.update({
          where: { email: 'admin@example.edu' },
          data: {
            visitorType: 'ADMIN' as any,
            status: 'ACTIVE'
          }
        });
        console.log('✅ ADMIN role restored to admin@example.edu!');
        console.log(`   Email: ${updated.email}`);
        console.log(`   New Role: ${updated.visitorType}`);
        console.log(`   Status: ${updated.status}\n`);
      } else {
        console.log('ℹ️  admin@example.edu already has ADMIN role.\n');
      }
    } else {
      console.log('❌ admin@example.edu not found in database.\n');
    }

    // Also check admin@ebsu.edu (new email)
    console.log('🔍 Checking for admin@ebsu.edu...');
    let newAdmin = await prisma.visitor.findUnique({
      where: { email: 'admin@ebsu.edu' }
    });

    if (newAdmin) {
      console.log(`✅ Found admin@ebsu.edu!`);
      console.log(`   Current role: ${newAdmin.visitorType}`);
      console.log(`   Current status: ${newAdmin.status}\n`);

      if (newAdmin.visitorType !== 'ADMIN') {
        const updated = await prisma.visitor.update({
          where: { email: 'admin@ebsu.edu' },
          data: {
            visitorType: 'ADMIN' as any,
            status: 'ACTIVE'
          }
        });
        console.log('✅ ADMIN role restored to admin@ebsu.edu!');
        console.log(`   Email: ${updated.email}`);
        console.log(`   New Role: ${updated.visitorType}`);
        console.log(`   Status: ${updated.status}\n`);
      } else {
        console.log('ℹ️  admin@ebsu.edu already has ADMIN role.\n');
      }
    } else {
      console.log('❌ admin@ebsu.edu not found in database.\n');
    }

    // If original admin exists but was changed to student, restore it
    // Also check if any visitor with STUDENT role might be the old admin
    console.log('🔍 Checking for visitors with STUDENT role that might be the old admin...');
    const studentVisitors = await prisma.visitor.findMany({
      where: { visitorType: 'STUDENT' }
    });

    if (studentVisitors.length > 0) {
      console.log(`Found ${studentVisitors.length} visitor(s) with STUDENT role:`);
      studentVisitors.forEach(v => {
        console.log(`   - ${v.email} (${v.name}) - Created: ${v.createdAt}`);
      });
      console.log('\n💡 If one of these is the old admin, you can restore it by running:');
      console.log(`   npx tsx packages/database/src/restore-original-admin.ts <email>\n`);
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    const adminVisitors = await prisma.visitor.findMany({
      where: { visitorType: 'ADMIN' }
    });
    console.log(`   Total ADMIN visitors: ${adminVisitors.length}`);
    adminVisitors.forEach(v => {
      console.log(`     - ${v.email} (${v.name})`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Allow email as command line argument
const emailArg = process.argv[2];
if (emailArg) {
  // If email provided, restore that specific email
  (async () => {
    const prisma = new PrismaClient();
    try {
      const visitor = await prisma.visitor.findUnique({
        where: { email: emailArg }
      });
      
      if (!visitor) {
        console.error(`❌ Visitor with email ${emailArg} not found!`);
        process.exit(1);
      }

      console.log(`🔧 Restoring ADMIN role to ${emailArg}...\n`);
      console.log(`   Current role: ${visitor.visitorType}`);
      console.log(`   Current status: ${visitor.status}\n`);

      const updated = await prisma.visitor.update({
        where: { email: emailArg },
        data: {
          visitorType: 'ADMIN' as any,
          status: 'ACTIVE'
        }
      });

      console.log('✅ ADMIN role restored!');
      console.log(`   Email: ${updated.email}`);
      console.log(`   Name: ${updated.name}`);
      console.log(`   New Role: ${updated.visitorType}`);
      console.log(`   Status: ${updated.status}`);
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
} else {
  restoreOriginalAdmin();
}

