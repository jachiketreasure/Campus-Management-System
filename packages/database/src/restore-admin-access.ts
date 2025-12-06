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

// Get email from command line argument or use default
const emailToFix = process.argv[2] || 'admin@example.com';

async function restoreAdminAccess() {
  console.log('🔧 Restoring admin access...\n');
  console.log(`Looking for: ${emailToFix}\n`);

  try {
    // Check Visitor table first (for exam integrity system)
    console.log('Checking Visitor table...');
    let visitor = await prisma.visitor.findUnique({
      where: { email: emailToFix }
    });

    if (visitor) {
      console.log(`✅ Found in Visitor table: ${visitor.name} (${visitor.email})`);
      console.log(`   Current role: ${visitor.visitorType}`);
      console.log(`   Current status: ${visitor.status}\n`);

      if (visitor.visitorType !== 'ADMIN') {
        const updated = await prisma.visitor.update({
          where: { email: emailToFix },
          data: {
            visitorType: 'ADMIN' as any,
            status: 'ACTIVE'
          }
        });

        console.log('✅ Admin role restored in Visitor table!');
        console.log(`   Email: ${updated.email}`);
        console.log(`   New Role: ${updated.visitorType}`);
        console.log(`   Status: ${updated.status}\n`);
      } else {
        console.log('ℹ️  Already has ADMIN role in Visitor table.\n');
      }
    } else {
      console.log('❌ Not found in Visitor table.\n');
    }

    // Check User table (for main system)
    console.log('Checking User table...');
    let user = await prisma.user.findUnique({
      where: { email: emailToFix },
      include: {
        roleAssignments: {
          include: { role: true }
        }
      }
    });

    if (user) {
      console.log(`✅ Found in User table: ${user.firstName} ${user.lastName} (${user.email})`);
      const currentRoles = user.roleAssignments.map(ra => ra.role.name);
      console.log(`   Current roles: ${currentRoles.join(', ') || 'None'}\n`);

      if (!currentRoles.includes('ADMIN')) {
        // Get ADMIN role
        const adminRole = await prisma.role.findUnique({
          where: { name: 'ADMIN' }
        });

        if (adminRole) {
          // Check if role assignment already exists
          const existingAssignment = await prisma.userRole.findUnique({
            where: {
              userId_roleId: {
                userId: user.id,
                roleId: adminRole.id
              }
            }
          });

          if (!existingAssignment) {
            await prisma.userRole.create({
              data: {
                userId: user.id,
                roleId: adminRole.id
              }
            });
            console.log('✅ Admin role added to User table!');
          } else {
            console.log('ℹ️  Admin role already assigned in User table.');
          }
        } else {
          console.log('⚠️  ADMIN role not found in database. Run seed script first.');
        }
      } else {
        console.log('ℹ️  Already has ADMIN role in User table.');
      }
    } else {
      console.log('❌ Not found in User table.\n');
    }

    // List all visitors and users for reference
    console.log('\n📋 All Visitors:');
    const allVisitors = await prisma.visitor.findMany({
      select: { email: true, visitorType: true, name: true }
    });
    allVisitors.forEach(v => {
      console.log(`   - ${v.email} (${v.visitorType}) - ${v.name}`);
    });

    console.log('\n📋 All Users:');
    const allUsers = await prisma.user.findMany({
      include: {
        roleAssignments: {
          include: { role: true }
        }
      }
    });
    allUsers.forEach(u => {
      const roles = u.roleAssignments.map(ra => ra.role.name).join(', ') || 'None';
      console.log(`   - ${u.email} (${roles}) - ${u.firstName} ${u.lastName}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

restoreAdminAccess();

