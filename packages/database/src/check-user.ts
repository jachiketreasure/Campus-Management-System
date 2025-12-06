import { prisma } from './index';

/**
 * Quick script to check if a user exists in the database
 * Usage: npx tsx packages/database/src/check-user.ts
 */

async function checkUser() {
  const email = 'admin@cms.local';

  try {
    console.log(`🔍 Checking for user: ${email}\n`);

    // Check exact match
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roleAssignments: {
          include: {
            role: true
          }
        }
      }
    });

    if (user) {
      console.log('✅ User found!');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Roles: ${user.roleAssignments.map(ra => ra.role.name).join(', ')}`);
      console.log(`   Has Password Hash: ${!!user.passwordHash}`);
    } else {
      console.log('❌ User not found with exact email match.\n');
      
      // List all users
      console.log('📋 Checking all users in database...');
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          roleAssignments: {
            include: {
              role: true
            }
          }
        },
        take: 20
      });

      if (allUsers.length === 0) {
        console.log('⚠️  No users found in database at all!');
      } else {
        console.log(`\n📊 Found ${allUsers.length} user(s) in database:\n`);
        allUsers.forEach((u, i) => {
          const roles = u.roleAssignments.map(ra => ra.role.name).join(', ') || 'No roles';
          console.log(`   ${i + 1}. ${u.email} (${u.firstName} ${u.lastName}) - Roles: ${roles}`);
        });

        // Check case-insensitive
        const caseInsensitiveMatch = allUsers.find(
          u => u.email.toLowerCase() === email.toLowerCase()
        );
        if (caseInsensitiveMatch) {
          console.log(`\n⚠️  Found similar email (case mismatch): ${caseInsensitiveMatch.email}`);
        }
      }
    }

    // Check database connection info
    console.log('\n🔗 Database connection info:');
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const url = new URL(dbUrl);
        const dbName = url.pathname.slice(1).split('?')[0];
        console.log(`   Database name: ${dbName || 'not specified'}`);
        console.log(`   Host: ${url.hostname}`);
      } catch {
        console.log(`   Could not parse DATABASE_URL`);
      }
    } else {
      console.log('   ⚠️  DATABASE_URL not set');
    }

  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();

