import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Load environment variables FIRST
const findProjectRoot = (): string => {
  let currentDir = __dirname;
  // Go up from src/seed-100-level-courses.ts -> src -> packages/database -> packages -> root
  for (let i = 0; i < 4; i++) {
    const envPath = path.resolve(currentDir, '.env');
    if (existsSync(envPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback to process.cwd()
  return process.cwd();
};

const projectRoot = findProjectRoot();
const rootEnvPath = path.resolve(projectRoot, '.env');
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

// Create Prisma client after env is loaded
const prisma = new PrismaClient();

// 100 Level First Semester Courses
const courses100Level = [
  { code: 'GST 103', title: 'Nigerian Peoples and Culture', units: 2, level: '100', semester: 'First' },
  { code: 'GST 102', title: 'Philosophy and Logic', units: 2, level: '100', semester: 'First' },
  { code: 'GST 101', title: 'Use of English I', units: 2, level: '100', semester: 'First' },
  { code: 'STA 101', title: 'Introduction to Statistics', units: 2, level: '100', semester: 'First' },
  { code: 'PHY 191/193', title: 'Practical Physics I', units: 1, level: '100', semester: 'First' },
  { code: 'BIO 191', title: 'Practical Biology I', units: 1, level: '100', semester: 'First' },
  { code: 'MAT 101', title: 'Algebra & Matrix', units: 3, level: '100', semester: 'First' },
  { code: 'CSC 101', title: 'Introduction to Computer Science', units: 2, level: '100', semester: 'First' },
  { code: 'PHY 101', title: 'General Physics I', units: 3, level: '100', semester: 'First' },
  { code: 'BIO 101', title: 'General Biology I', units: 2, level: '100', semester: 'First' },
  { code: 'ICH 191', title: 'General Chemistry Practical I', units: 1, level: '100', semester: 'First' },
  { code: 'ICH 101', title: 'General Chemistry I (Inorganic)', units: 2, level: '100', semester: 'First' },
];

async function seed100LevelCourses() {
  console.log('📚 Seeding 100 Level First Semester courses...\n');

  try {
    // Get or create a default lecturer (we'll use the first lecturer or create one)
    let lecturer = await prisma.user.findFirst({
      where: {
        roleAssignments: {
          some: {
            role: {
              name: 'LECTURER'
            }
          }
        }
      }
    });

    if (!lecturer) {
      // Try to find any user that could be a lecturer
      lecturer = await prisma.user.findFirst({
        where: {
          email: { contains: 'lecturer' }
        }
      });

      if (!lecturer) {
        // Create a default lecturer if none exists
        // First ensure LECTURER role exists
        let lecturerRole = await prisma.role.findUnique({
          where: { name: 'LECTURER' }
        });

        if (!lecturerRole) {
          // Create the role if it doesn't exist
          lecturerRole = await prisma.role.create({
            data: {
              name: 'LECTURER',
              description: 'Course lecturers and proctors'
            }
          });
          console.log('✅ Created LECTURER role');
        }

        // Create default lecturer user
        const passwordHash = bcrypt.hashSync('ChangeMe123!', 10);
        
        lecturer = await prisma.user.create({
          data: {
            email: 'lecturer@ebsu.edu',
            passwordHash,
            firstName: 'Default',
            lastName: 'Lecturer',
            roleAssignments: {
              create: {
                roleId: lecturerRole.id
              }
            }
          }
        });
        console.log('✅ Created default lecturer for courses');
      }
    }

    console.log(`Using lecturer: ${lecturer.firstName} ${lecturer.lastName} (${lecturer.email})\n`);

    // Seed courses
    let created = 0;
    let updated = 0;

    for (const course of courses100Level) {
      const existing = await prisma.course.findUnique({
        where: { code: course.code }
      });

      if (existing) {
        await prisma.course.update({
          where: { code: course.code },
          data: {
            title: course.title,
            units: course.units,
            level: course.level,
            semester: course.semester,
            description: `${course.level} Level ${course.semester} Semester - ${course.units} unit${course.units !== 1 ? 's' : ''}`
          }
        });
        updated++;
        console.log(`  ✓ Updated: ${course.code} - ${course.title} (${course.units} units, ${course.level} Level)`);
      } else {
        await prisma.course.create({
          data: {
            code: course.code,
            title: course.title,
            units: course.units,
            level: course.level,
            semester: course.semester,
            description: `${course.level} Level ${course.semester} Semester - ${course.units} unit${course.units !== 1 ? 's' : ''}`,
            lecturerId: lecturer.id
          }
        });
        created++;
        console.log(`  ✓ Created: ${course.code} - ${course.title} (${course.units} units, ${course.level} Level)`);
      }
    }

    console.log(`\n✅ Successfully seeded 100 Level courses!`);
    console.log(`   Created: ${created} courses`);
    console.log(`   Updated: ${updated} courses`);
    console.log(`   Total: ${courses100Level.length} courses\n`);

  } catch (error) {
    console.error('❌ Failed to seed 100 Level courses:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

seed100LevelCourses();

