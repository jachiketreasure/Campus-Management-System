import { prisma } from './index';

/**
 * Script to fix admin user account role
 * This script helps restore admin access when an admin account has been mistakenly assigned a student role
 * 
 * Usage:
 * 1. Run: npm run fix-user-admin --workspace @cms/database
 * 2. Or: npx tsx packages/database/src/fix-user-admin-role.ts admin@example.edu
 */

async function fixUserAdminRole(email: string) {
  try {
    console.log(`\n🔍 Looking for user with email: ${email}\n`);

    // Find user by email
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

    if (!user) {
      console.error(`❌ No user found with email: ${email}`);
      return false;
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   Current roles: ${user.roleAssignments.map(ra => ra.role.name).join(', ') || 'None'}\n`);

    // Check if user already has ADMIN role
    const hasAdminRole = user.roleAssignments.some(ra => ra.role.name === 'ADMIN');
    if (hasAdminRole) {
      console.log('✅ This user already has ADMIN role. No changes needed.');
      return true;
    }

    // Get the ADMIN role
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' }
    });

    if (!adminRole) {
      console.error('❌ ADMIN role not found in database. Creating it...');
      // Create ADMIN role if it doesn't exist
      const newAdminRole = await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'Platform administrators with full access'
        }
      });
      console.log('✅ Created ADMIN role');
      
      // Remove all existing role assignments
      await prisma.userRole.deleteMany({
        where: { userId: user.id }
      });

      // Add ADMIN role
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: newAdminRole.id
        }
      });
    } else {
      // Remove all existing role assignments
      await prisma.userRole.deleteMany({
        where: { userId: user.id }
      });

      // Add ADMIN role
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id
        }
      });
    }

    // Verify the update
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roleAssignments: {
          include: {
            role: true
          }
        }
      }
    });

    console.log('✅ Successfully updated user role to ADMIN!');
    console.log(`\n📝 Updated user details:`);
    console.log(`   Name: ${updatedUser!.firstName} ${updatedUser!.lastName}`);
    console.log(`   Email: ${updatedUser!.email}`);
    console.log(`   Roles: ${updatedUser!.roleAssignments.map(ra => ra.role.name).join(', ')}\n`);
    console.log('🎉 You can now log in to the admin portal!\n');

    return true;
  } catch (error: any) {
    console.error('❌ Error updating user role:', error.message);
    if (error.code === 'P2002') {
      console.error('   This might be a unique constraint violation.');
    }
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Get email from command line or use default
  const email = args[0] || 'admin@example.edu';

  console.log('🔧 Admin User Role Fix Script');
  console.log('=============================\n');
  console.log('This script helps restore admin access when an admin account has been mistakenly assigned a student role.\n');

  const success = await fixUserAdminRole(email);

  await prisma.$disconnect();

  if (!success) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

