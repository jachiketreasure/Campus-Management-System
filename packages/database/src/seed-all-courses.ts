import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Load environment variables FIRST
const findProjectRoot = (): string => {
  let currentDir = __dirname;
  for (let i = 0; i < 4; i++) {
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

// Course data extracted from student registration
const allCourses = [
  // 100 LEVEL - FIRST SEMESTER
  { code: 'GST 103', title: 'NIGERIAN PEOPLES AND CULTURE', units: 2, level: '100', semester: 'First', courseType: 'GENERAL STUDIES' },
  { code: 'GST 102', title: 'PHILOSOPHY AND LOGIC', units: 2, level: '100', semester: 'First', courseType: 'GENERAL STUDIES' },
  { code: 'STA 101', title: 'INTRODUCTION TO STATISTICS', units: 2, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'GST 101', title: 'USE OF ENGLISH I', units: 2, level: '100', semester: 'First', courseType: 'GENERAL STUDIES' },
  { code: 'PHY 191/193', title: 'PRACTICAL PHYSICS I', units: 1, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'BIO 191', title: 'PRACTICAL BIOLOGY I', units: 1, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'MAT 101', title: 'ALGEBRA & MATRIX', units: 3, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'CSC 101', title: 'INTRODUCTION TO COMPUTER SCIENCE', units: 2, level: '100', semester: 'First', courseType: 'COMPULSORY' },
  { code: 'PHY 101', title: 'GENERAL PHYSICS I', units: 3, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'BIO 101', title: 'GENERAL BIOLOGY I', units: 2, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'ICH 191', title: 'GENERAL CHEMISTRY PRACTICAL I', units: 1, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'ICH 101', title: 'GENERAL CHEMISTRY I (INORGANIC)', units: 2, level: '100', semester: 'First', courseType: 'REQUIRED' },
  { code: 'GST 105', title: 'INTRODUCTION TO IGBO LANGUAGE AND CULTURE', units: 1, level: '100', semester: 'First', courseType: 'COMPULSORY' },

  // 100 LEVEL - SECOND SEMESTER
  { code: 'CSC 112', title: 'INTRODUCTION TO COMPUTER PROGRAMMING', units: 3, level: '100', semester: 'Second', courseType: 'COMPULSORY' },
  { code: 'GST 107', title: 'USE OF ENGLISH II', units: 2, level: '100', semester: 'Second', courseType: 'GENERAL STUDIES' },
  { code: 'MAT 102', title: 'CALCULUS & TRIGONOMETRY', units: 3, level: '100', semester: 'Second', courseType: 'REQUIRED' },
  { code: 'BIO 102', title: 'GENERAL BIOLOGY II', units: 2, level: '100', semester: 'Second', courseType: 'ELECTIVE' },
  { code: 'MAT 104', title: 'VECTORS AND COORDINATE GEOMETRY', units: 2, level: '100', semester: 'Second', courseType: 'ANCILLARY' },
  { code: 'CSC 102', title: 'INTRODUCTION TO COMPUTER SYSTEMS I', units: 2, level: '100', semester: 'Second', courseType: 'COMPULSORY' },
  { code: 'PHY 192', title: 'GENERAL PRACTICAL PHYSICS II', units: 1, level: '100', semester: 'Second', courseType: 'REQUIRED' },
  { code: 'GST 106', title: 'SOCIAL SCIENCES', units: 2, level: '100', semester: 'Second', courseType: 'GENERAL STUDIES' },
  { code: 'BIO 192', title: 'GENERAL BIOLOGY PRACTICALS II', units: 1, level: '100', semester: 'Second', courseType: 'ELECTIVE' },
  { code: 'PHY 102', title: 'GENERAL PHYSICS II', units: 3, level: '100', semester: 'Second', courseType: 'REQUIRED' },
  { code: 'GST 108', title: 'INTRODUCTION TO IGBO LANGUAGE AND CULTURE II', units: 1, level: '100', semester: 'Second', courseType: 'COMPULSORY' },

  // 200 LEVEL - FIRST SEMESTER
  { code: 'CSC 231', title: 'DATA STRUCTURE AND ALGORITHMS', units: 2, level: '200', semester: 'First', courseType: 'CORE' },
  { code: 'MAT 201', title: 'MATHEMATICAL METHODS I', units: 2, level: '200', semester: 'First', courseType: 'REQUIRED' },
  { code: 'CSC 221B', title: 'COMPUTER INFORMATION TECHNOLOGY AND INTERNET CONCEPT', units: 2, level: '200', semester: 'First', courseType: 'CORE' },
  { code: 'GST 201', title: 'ENTREPRENEURIAL STUDIES I', units: 1, level: '200', semester: 'First', courseType: 'GENERAL STUDIES' },
  { code: 'CSC 215B', title: 'LOW LEVEL PROGRAMMING', units: 2, level: '200', semester: 'First', courseType: 'CORE' },
  { code: 'STA 201', title: 'STATISTICS FOR APPLIED SCIENCES', units: 2, level: '200', semester: 'First', courseType: 'ELECTIVE' },
  { code: 'MAT 211B', title: 'SET, LOGICS & ALGEBRA', units: 2, level: '200', semester: 'First', courseType: 'REQUIRED' },
  { code: 'CSC 217', title: 'STRUCTURED AND VISUAL PROGRAMMING', units: 2, level: '200', semester: 'First', courseType: 'COMPULSORY' },
  { code: 'CSC 213B', title: 'SEQUENTIAL PROGRAMMING AND FILE PROCESSING', units: 2, level: '200', semester: 'First', courseType: 'CORE' },
  { code: 'PHY 261B', title: 'MODERN PHYSICS', units: 2, level: '200', semester: 'First', courseType: 'REQUIRED' },

  // 200 LEVEL - SECOND SEMESTER
  { code: 'CSC 216', title: 'INTERNET PROGRAMMING', units: 2, level: '200', semester: 'Second', courseType: 'CORE' },
  { code: 'CSC 242B', title: 'DIGITAL DESIGN AND LOGICS', units: 2, level: '200', semester: 'Second', courseType: 'CORE' },
  { code: 'MAT 212', title: 'INTRODUCTION TO REAL ANALYSIS', units: 2, level: '200', semester: 'Second', courseType: 'REQUIRED' },
  { code: 'MAT 202B', title: 'MATHEMATICAL METHODS II', units: 2, level: '200', semester: 'Second', courseType: 'REQUIRED' },
  { code: 'CSC 204', title: 'DATABASE CREATION MANAGEMENT', units: 2, level: '200', semester: 'Second', courseType: 'COMPULSORY' },
  { code: 'CSC 226', title: 'SYSTEM ANALYSIS AND DESIGN', units: 2, level: '200', semester: 'Second', courseType: 'COMPULSORY' },
  { code: 'PHY 262B', title: 'ELECTRIC CIRCUIT AND ELECTRONICS', units: 3, level: '200', semester: 'Second', courseType: 'REQUIRED' },
  { code: 'CSC 232', title: 'NUMERICAL METHODS I', units: 2, level: '200', semester: 'Second', courseType: 'COMPULSORY' },

  // 300 LEVEL - FIRST SEMESTER
  { code: 'CSC 313', title: 'SURVEY OF PROGRAMMING LANGUAGES', units: 2, level: '300', semester: 'First', courseType: 'CORE' },
  { code: 'CSC 321', title: 'COMPILER CONSTRUCTION I', units: 2, level: '300', semester: 'First', courseType: 'COMPULSORY' },
  { code: 'CSC 303', title: 'CLOUD COMPUTING', units: 2, level: '300', semester: 'First', courseType: 'ELECTIVE' },
  { code: 'GST 301', title: 'ENTREPRENEURIAL STUDIES', units: 1, level: '300', semester: 'First', courseType: 'GENERAL STUDIES' },
  { code: 'CSC 343', title: 'COMPUTER ARCHITECTURE', units: 2, level: '300', semester: 'First', courseType: 'COMPULSORY' },
  { code: 'CSC 311B', title: 'OBJECT ORIENTED PROGRAMMING', units: 2, level: '300', semester: 'First', courseType: 'CORE' },
  { code: 'STA 331', title: 'STATISTICAL INFERENCE III', units: 2, level: '300', semester: 'First', courseType: 'CORE' },
  { code: 'CSC 333B', title: 'DISCRETE STRUCTURE', units: 2, level: '300', semester: 'First', courseType: 'CORE' },
  { code: 'CSC 325B', title: 'SOFTWARE ENGINEERING', units: 2, level: '300', semester: 'First', courseType: 'CORE' },
  { code: 'CSC 323', title: 'OPERATING SYSTEMS I', units: 2, level: '300', semester: 'First', courseType: 'COMPULSORY' },

  // 300 LEVEL - SECOND SEMESTER
  { code: 'CSC 398', title: 'SIWES', units: 18, level: '300', semester: 'Second', courseType: 'COMPULSORY' },
];

async function seedAllCourses() {
  console.log('📚 Seeding all courses (100, 200, 300 levels)...\n');

  try {
    // Get or create a default lecturer
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
        let lecturerRole = await prisma.role.findUnique({
          where: { name: 'LECTURER' }
        });

        if (!lecturerRole) {
          lecturerRole = await prisma.role.create({
            data: {
              name: 'LECTURER',
              description: 'Course lecturers and proctors'
            }
          });
          console.log('✅ Created LECTURER role');
        }

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
    const byLevel: Record<string, { first: number; second: number }> = {};

    for (const course of allCourses) {
      const existing = await prisma.course.findUnique({
        where: { code: course.code }
      });

      const description = `${course.level} Level ${course.semester} Semester - ${course.units} unit${course.units !== 1 ? 's' : ''} - ${course.courseType}`;

      if (existing) {
        await prisma.course.update({
          where: { code: course.code },
          data: {
            title: course.title,
            units: course.units,
            level: course.level,
            semester: course.semester,
            description
          }
        });
        updated++;
        console.log(`  ✓ Updated: ${course.code} - ${course.title} (${course.units} units, ${course.level} Level, ${course.semester} Semester)`);
      } else {
        await prisma.course.create({
          data: {
            code: course.code,
            title: course.title,
            units: course.units,
            level: course.level,
            semester: course.semester,
            description,
            lecturerId: lecturer.id
          }
        });
        created++;
        console.log(`  ✓ Created: ${course.code} - ${course.title} (${course.units} units, ${course.level} Level, ${course.semester} Semester)`);
      }

      // Track by level
      if (!byLevel[course.level]) {
        byLevel[course.level] = { first: 0, second: 0 };
      }
      if (course.semester === 'First') {
        byLevel[course.level].first += course.units;
      } else {
        byLevel[course.level].second += course.units;
      }
    }

    console.log(`\n✅ Successfully seeded all courses!`);
    console.log(`   Created: ${created} courses`);
    console.log(`   Updated: ${updated} courses`);
    console.log(`   Total: ${allCourses.length} courses\n`);

    console.log('📊 Summary by Level:');
    for (const [level, totals] of Object.entries(byLevel)) {
      console.log(`   ${level} Level:`);
      console.log(`     First Semester: ${totals.first} units`);
      console.log(`     Second Semester: ${totals.second} units`);
      console.log(`     Total: ${totals.first + totals.second} units`);
    }

  } catch (error) {
    console.error('❌ Failed to seed courses:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

seedAllCourses();












