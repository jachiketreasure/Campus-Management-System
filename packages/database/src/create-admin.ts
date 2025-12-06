import bcrypt from 'bcryptjs';
import { prisma } from './index';

/**
 * Creates a new admin user with secure credentials
 * Usage: npm run create-admin --workspace @cms/database
 */
async function createAdminUser() {
  console.log('🔐 Creating new admin user...\n');

  // Generate secure credentials
  const timestamp = Date.now();
  const adminEmail = `admin-${timestamp}@cms.local`;
  const adminPassword = generateSecurePassword();
  const adminFirstName = 'System';
  const adminLastName = 'Administrator';

  try {
    // Ensure ADMIN role exists
    let adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' }
    });

    if (!adminRole) {
      console.log('📝 Creating ADMIN role...');
      adminRole = await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'Platform administrators with full access'
        }
      });
      console.log('✅ ADMIN role created\n');
    } else {
      console.log('✅ ADMIN role already exists\n');
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingUser) {
      console.log('⚠️  User with this email already exists. Updating password and ensuring ADMIN role...');
      
      // Update password
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash }
      });

      // Ensure ADMIN role is assigned
      const existingRoleAssignment = await prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId: existingUser.id,
            roleId: adminRole.id
          }
        }
      });

      if (!existingRoleAssignment) {
        await prisma.userRole.create({
          data: {
            userId: existingUser.id,
            roleId: adminRole.id
          }
        });
        console.log('✅ ADMIN role assigned to existing user\n');
      }

      console.log('\n' + '='.repeat(60));
      console.log('✅ Admin user updated successfully!');
      console.log('='.repeat(60));
      console.log(`📧 Email:    ${adminEmail}`);
      console.log(`🔑 Password: ${adminPassword}`);
      console.log('='.repeat(60) + '\n');
      
      await prisma.$disconnect();
      return;
    }

    // Hash password with bcrypt (12 rounds for security)
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Create admin user with ADMIN role, profile, and wallet
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: adminFirstName,
        lastName: adminLastName,
        roleAssignments: {
          create: {
            roleId: adminRole.id
          }
        },
        profile: {
          create: {
            bio: 'System administrator with full access to all platform features',
            skills: ['System Administration', 'User Management', 'Platform Governance']
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
        }
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Admin user created successfully!');
    console.log('='.repeat(60));
    console.log(`👤 Name:     ${adminFirstName} ${adminLastName}`);
    console.log(`📧 Email:    ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log(`🆔 User ID:  ${adminUser.id}`);
    console.log(`👑 Roles:    ${adminUser.roleAssignments.map(ra => ra.role.name).join(', ')}`);
    console.log('='.repeat(60));
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('   You can now use these credentials to access the admin dashboard.\n');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

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

// Run the script
createAdminUser()
  .catch((error) => {
    console.error('❌ Failed to create admin user:', error);
    process.exitCode = 1;
  });

