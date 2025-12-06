import bcrypt from 'bcryptjs';
import { prisma } from './index';

/**
 * Creates a default admin user with secure credentials
 * This creates a standard admin account that can access all admin features
 * 
 * Usage: npm run create-default-admin --workspace @cms/database
 * Or: npx tsx packages/database/src/create-default-admin.ts
 */

const DEFAULT_ADMIN_EMAIL = 'admin@cms.local';
const DEFAULT_ADMIN_FIRST_NAME = 'System';
const DEFAULT_ADMIN_LAST_NAME = 'Administrator';

/**
 * Generates a secure random password
 * Format: 16 characters with uppercase, lowercase, numbers, and special characters
 */
function generateSecurePassword(): string {
  const length = 16;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one character from each category
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function createDefaultAdmin() {
  console.log('🔐 Creating default admin user...\n');

  // Generate secure password
  const adminPassword = generateSecurePassword();

  try {
    // Step 1: Ensure ADMIN role exists
    let adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' }
    });

    if (!adminRole) {
      console.log('📝 Creating ADMIN role...');
      adminRole = await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'Platform administrators with full access to all features'
        }
      });
      console.log('✅ ADMIN role created\n');
    } else {
      console.log('✅ ADMIN role already exists\n');
    }

    // Step 2: Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL },
      include: {
        roleAssignments: {
          include: {
            role: true
          }
        }
      }
    });

    let adminUser;

    if (existingUser) {
      console.log('⚠️  User with this email already exists. Updating password and ensuring ADMIN role...');
      
      // Update password
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash }
      });

      // Check if ADMIN role is assigned
      const hasAdminRole = existingUser.roleAssignments.some(
        ra => ra.role.name === 'ADMIN'
      );

      if (!hasAdminRole) {
        // Remove all existing role assignments
        await prisma.userRole.deleteMany({
          where: { userId: existingUser.id }
        });

        // Add ADMIN role
        await prisma.userRole.create({
          data: {
            userId: existingUser.id,
            roleId: adminRole.id
          }
        });
        console.log('✅ ADMIN role assigned to existing user\n');
      } else {
        console.log('✅ User already has ADMIN role\n');
      }

      adminUser = await prisma.user.findUnique({
        where: { id: existingUser.id },
        include: {
          roleAssignments: {
            include: {
              role: true
            }
          },
          profile: true,
          wallet: true
        }
      });
    } else {
      // Step 3: Create new admin user
      console.log('📝 Creating new admin user...');
      
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      adminUser = await prisma.user.create({
        data: {
          email: DEFAULT_ADMIN_EMAIL,
          passwordHash,
          firstName: DEFAULT_ADMIN_FIRST_NAME,
          lastName: DEFAULT_ADMIN_LAST_NAME,
          roleAssignments: {
            create: {
              roleId: adminRole.id
            }
          },
          profile: {
            create: {
              bio: 'System administrator with full access to all platform features, user management, exam settings, and system configuration',
              skills: ['System Administration', 'User Management', 'Platform Governance', 'Security', 'Compliance']
            }
          },
          wallet: {
            create: {
              balance: 0,
              currency: 'NGN'
            }
          }
        },
        include: {
          roleAssignments: {
            include: {
              role: true
            }
          },
          profile: true,
          wallet: true
        }
      });

      console.log('✅ Admin user created in User table\n');
    }

    // Step 4: Ensure Visitor entry exists for API-based authentication compatibility
    const existingVisitor = await prisma.visitor.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL }
    });

    if (!existingVisitor) {
      console.log('📝 Creating Visitor entry for API authentication compatibility...');
      const visitorPasswordHash = await bcrypt.hash(adminPassword, 12);
      
      await prisma.visitor.create({
        data: {
          name: `${DEFAULT_ADMIN_FIRST_NAME} ${DEFAULT_ADMIN_LAST_NAME}`,
          email: DEFAULT_ADMIN_EMAIL,
          passwordHash: visitorPasswordHash,
          visitorType: 'ADMIN',
          status: 'ACTIVE',
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        }
      });
      console.log('✅ Visitor entry created\n');
    } else {
      // Update visitor to ensure it has ADMIN type and correct password
      const visitorPasswordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.visitor.update({
        where: { id: existingVisitor.id },
        data: {
          visitorType: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: visitorPasswordHash,
          isEmailVerified: true,
          emailVerifiedAt: new Date()
        }
      });
      console.log('✅ Visitor entry updated with ADMIN type\n');
    }

    // Step 5: Display success message with credentials
    console.log('\n' + '='.repeat(70));
    console.log('✅ DEFAULT ADMIN USER CREATED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log(`👤 Name:     ${DEFAULT_ADMIN_FIRST_NAME} ${DEFAULT_ADMIN_LAST_NAME}`);
    console.log(`📧 Email:    ${DEFAULT_ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log(`🆔 User ID:  ${adminUser!.id}`);
    console.log(`👑 Roles:    ${adminUser!.roleAssignments.map(ra => ra.role.name).join(', ')}`);
    console.log('='.repeat(70));
    console.log('\n📋 ADMIN PERMISSIONS:');
    console.log('   ✓ Full access to admin dashboard');
    console.log('   ✓ User management (create, update, delete users)');
    console.log('   ✓ Exam management and integrity settings');
    console.log('   ✓ System configuration and settings');
    console.log('   ✓ Marketplace management');
    console.log('   ✓ All admin-only routes and features');
    console.log('\n🔐 AUTHENTICATION METHODS:');
    console.log('   • NextAuth: Use email/password at /auth/signin');
    console.log('   • API Auth: Use email/password for API endpoints');
    console.log('   • Admin Portal: Use email/password at /auth/signin/admin');
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('   Change the password after first login for enhanced security.\n');

  } catch (error) {
    console.error('❌ Error creating default admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createDefaultAdmin()
  .catch((error) => {
    console.error('❌ Failed to create default admin user:', error);
    process.exitCode = 1;
  });








