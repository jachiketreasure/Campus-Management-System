import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

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

// Also try .env.local
const localEnvPath = path.resolve(projectRoot, '.env.local');
if (existsSync(localEnvPath)) {
  config({ path: localEnvPath, override: false });
}

// Try apps/web/.env.local
const webEnvPath = path.resolve(projectRoot, 'apps/web/.env.local');
if (existsSync(webEnvPath)) {
  config({ path: webEnvPath, override: false });
}

// Try apps/web/.env
const webEnvPath2 = path.resolve(projectRoot, 'apps/web/.env');
if (existsSync(webEnvPath2)) {
  config({ path: webEnvPath2, override: false });
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface CourseData {
  code: string;
  title: string;
  units: number;
  level: string;
  semester: string;
  sessionName: string;
}

async function updateCourses() {
  try {
    console.log('🔄 Starting course database update...');

    // Get or create academic sessions
    const sessions = await Promise.all([
      prisma.academicSession.upsert({
        where: { name: '2022-2023' },
        update: {},
        create: {
          name: '2022-2023',
          startDate: new Date('2022-09-01'),
          endDate: new Date('2023-08-31'),
          status: 'ACTIVE',
          isActive: true,
          registrationOpen: true,
        },
      }),
      prisma.academicSession.upsert({
        where: { name: '2023-2024' },
        update: {},
        create: {
          name: '2023-2024',
          startDate: new Date('2023-09-01'),
          endDate: new Date('2024-08-31'),
          status: 'ACTIVE',
          isActive: true,
          registrationOpen: true,
        },
      }),
      prisma.academicSession.upsert({
        where: { name: '2024-2025' },
        update: {},
        create: {
          name: '2024-2025',
          startDate: new Date('2024-09-01'),
          endDate: new Date('2025-08-31'),
          status: 'ACTIVE',
          isActive: true,
          registrationOpen: true,
        },
      }),
      prisma.academicSession.upsert({
        where: { name: '2025-2026' },
        update: {},
        create: {
          name: '2025-2026',
          startDate: new Date('2025-09-01'),
          endDate: new Date('2026-08-31'),
          status: 'ACTIVE',
          isActive: true,
          registrationOpen: true,
        },
      }),
      prisma.academicSession.upsert({
        where: { name: '2026-2027' },
        update: {},
        create: {
          name: '2026-2027',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-08-31'),
          status: 'ACTIVE',
          isActive: true,
          registrationOpen: true,
        },
      }),
    ]);

    const sessionMap = Object.fromEntries(sessions.map(s => [s.name, s.id]));
    console.log('✅ Academic sessions ready');

    // Get a lecturer (required for courses)
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
      // Create a default lecturer if none exists
      const roles = await prisma.role.findMany();
      const lecturerRole = roles.find(r => r.name === 'LECTURER');
      
      if (!lecturerRole) {
        throw new Error('LECTURER role not found');
      }

      lecturer = await prisma.user.create({
        data: {
          email: 'lecturer@example.edu',
          passwordHash: 'dummy', // Will be updated later
          firstName: 'Default',
          lastName: 'Lecturer',
          roleAssignments: {
            create: {
              roleId: lecturerRole.id
            }
          }
        }
      });
      console.log('✅ Created default lecturer');
    }

    // Define all courses
    const courses: CourseData[] = [
      // 100 LEVEL - 2022-2023 - FIRST SEMESTER
      { code: 'GST 103', title: 'Nigerian Peoples and Culture', units: 2, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'GST 102', title: 'Philosophy and Logic', units: 2, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'STA 101', title: 'Introduction to Statistics', units: 2, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'GST 101', title: 'Use of English I', units: 2, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'PHY 191/193', title: 'Practical Physics I', units: 1, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'BIO 191', title: 'Practical Biology I', units: 1, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'MAT 101', title: 'Algebra & Matrix', units: 3, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'CSC 101', title: 'Introduction to Computer Science', units: 2, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'PHY 101', title: 'General Physics I', units: 3, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'BIO 101', title: 'General Biology I', units: 2, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'ICH 191', title: 'General Chemistry Practical I', units: 1, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'ICH 101', title: 'General Chemistry I (Inorganic)', units: 2, level: '100', semester: 'First', sessionName: '2022-2023' },
      { code: 'GST 105', title: 'Introduction to Igbo Language and Culture', units: 1, level: '100', semester: 'First', sessionName: '2022-2023' },

      // 100 LEVEL - 2022-2023 - SECOND SEMESTER
      { code: 'CSC 112', title: 'Introduction to Computer Programming', units: 3, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'GST 107', title: 'Use of English II', units: 2, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'MAT 102', title: 'Calculus & Trigonometry', units: 3, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'BIO 102', title: 'General Biology II', units: 2, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'MAT 104', title: 'Vectors and Coordinate Geometry', units: 2, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'CSC 102', title: 'Introduction to Computer Systems I', units: 2, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'PHY 192', title: 'General Practical Physics II', units: 1, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'GST 106', title: 'Social Sciences', units: 2, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'BIO 192', title: 'General Biology Practicals II', units: 1, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'PHY 102', title: 'General Physics II', units: 3, level: '100', semester: 'Second', sessionName: '2022-2023' },
      { code: 'GST 108', title: 'Introduction to Igbo Language and Culture II', units: 1, level: '100', semester: 'Second', sessionName: '2022-2023' },

      // 200 LEVEL - 2023-2024 - FIRST SEMESTER
      { code: 'CSC 231', title: 'Data Structure and Algorithms', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'MAT 201', title: 'Mathematical Methods I', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'CSC 221B', title: 'Computer Information Technology and Internet Concept', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'GST 201', title: 'Entrepreneurial Studies I', units: 1, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'CSC 215B', title: 'Low Level Programming', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'STA 201', title: 'Statistics for Applied Sciences', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'MAT 211B', title: 'Set, Logics & Algebra', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'CSC 217', title: 'Structured and Visual Programming', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'CSC 213B', title: 'Sequential Programming and File Processing', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },
      { code: 'PHY 261B', title: 'Modern Physics', units: 2, level: '200', semester: 'First', sessionName: '2023-2024' },

      // 200 LEVEL - 2023-2024 - SECOND SEMESTER
      { code: 'CSC 216', title: 'Internet Programming', units: 2, level: '200', semester: 'Second', sessionName: '2023-2024' },
      { code: 'CSC 242B', title: 'Digital Design and Logics', units: 2, level: '200', semester: 'Second', sessionName: '2023-2024' },
      { code: 'MAT 212', title: 'Introduction to Real Analysis', units: 2, level: '200', semester: 'Second', sessionName: '2023-2024' },
      { code: 'MAT 202B', title: 'Mathematical Methods II', units: 2, level: '200', semester: 'Second', sessionName: '2023-2024' },
      { code: 'CSC 204', title: 'Database Creation Management', units: 2, level: '200', semester: 'Second', sessionName: '2023-2024' },
      { code: 'CSC 226', title: 'System Analysis and Design', units: 2, level: '200', semester: 'Second', sessionName: '2023-2024' },
      { code: 'PHY 262B', title: 'Electric Circuit and Electronics', units: 3, level: '200', semester: 'Second', sessionName: '2023-2024' },
      { code: 'CSC 232', title: 'Numerical Methods I', units: 2, level: '200', semester: 'Second', sessionName: '2023-2024' },

      // 300 LEVEL - 2024-2025 - FIRST SEMESTER
      { code: 'CSC 313', title: 'Survey of Programming Languages', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'CSC 321', title: 'Compiler Construction I', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'CSC 303', title: 'Cloud Computing', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'GST 301', title: 'Entrepreneurial Studies', units: 1, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'CSC 343', title: 'Computer Architecture', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'CSC 311B', title: 'Object Oriented Programming', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'STA 331', title: 'Statistical Inference III', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'CSC 333B', title: 'Discrete Structure', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'CSC 325B', title: 'Software Engineering', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },
      { code: 'CSC 323', title: 'Operating Systems I', units: 2, level: '300', semester: 'First', sessionName: '2024-2025' },

      // 300 LEVEL - 2024-2025 - SECOND SEMESTER
      { code: 'CSC 398', title: 'SIWES', units: 18, level: '300', semester: 'Second', sessionName: '2024-2025' },

      // 400 LEVEL - 2025-2026 - FIRST SEMESTER
      { code: 'CSC 401', title: 'Distributed Systems', units: 3, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 403', title: 'Artificial Intelligence', units: 3, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 405', title: 'Computer Networks', units: 3, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 407', title: 'Database Management Systems', units: 3, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 409', title: 'Information Security', units: 2, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 411', title: 'Web Technologies', units: 2, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 413', title: 'Mobile Application Development', units: 2, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 415', title: 'Machine Learning', units: 3, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'CSC 417', title: 'Project Management', units: 2, level: '400', semester: 'First', sessionName: '2025-2026' },
      { code: 'GST 401', title: 'Entrepreneurship and Innovation', units: 2, level: '400', semester: 'First', sessionName: '2025-2026' },

      // 400 LEVEL - 2025-2026 - SECOND SEMESTER
      { code: 'CSC 402', title: 'Advanced Algorithms', units: 3, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 404', title: 'Cybersecurity', units: 3, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 406', title: 'Big Data Analytics', units: 3, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 408', title: 'Software Testing and Quality Assurance', units: 2, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 410', title: 'Internet of Things (IoT)', units: 2, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 412', title: 'Blockchain Technology', units: 2, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 414', title: 'Human-Computer Interaction', units: 2, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 416', title: 'Research Methodology', units: 2, level: '400', semester: 'Second', sessionName: '2025-2026' },
      { code: 'CSC 498', title: 'Final Year Project', units: 6, level: '400', semester: 'Second', sessionName: '2025-2026' },

      // 500 LEVEL - 2026-2027 - FIRST SEMESTER
      { code: 'CSC 501', title: 'Advanced Database Systems', units: 3, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 503', title: 'Deep Learning', units: 3, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 505', title: 'Cloud Computing Architecture', units: 3, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 507', title: 'Advanced Software Engineering', units: 3, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 509', title: 'Network Security', units: 2, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 511', title: 'Data Mining', units: 2, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 513', title: 'Advanced Operating Systems', units: 3, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 515', title: 'Computer Graphics', units: 2, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 517', title: 'Parallel and Distributed Computing', units: 3, level: '500', semester: 'First', sessionName: '2026-2027' },
      { code: 'CSC 519', title: 'Seminar in Computer Science', units: 1, level: '500', semester: 'First', sessionName: '2026-2027' },

      // 500 LEVEL - 2026-2027 - SECOND SEMESTER
      { code: 'CSC 502', title: 'Advanced Topics in AI', units: 3, level: '500', semester: 'Second', sessionName: '2026-2027' },
      { code: 'CSC 504', title: 'Software Architecture', units: 3, level: '500', semester: 'Second', sessionName: '2026-2027' },
      { code: 'CSC 506', title: 'Advanced Web Development', units: 2, level: '500', semester: 'Second', sessionName: '2026-2027' },
      { code: 'CSC 508', title: 'Cryptography', units: 2, level: '500', semester: 'Second', sessionName: '2026-2027' },
      { code: 'CSC 510', title: 'Advanced Machine Learning', units: 3, level: '500', semester: 'Second', sessionName: '2026-2027' },
      { code: 'CSC 512', title: 'Distributed Database Systems', units: 2, level: '500', semester: 'Second', sessionName: '2026-2027' },
      { code: 'CSC 514', title: 'Advanced Network Protocols', units: 2, level: '500', semester: 'Second', sessionName: '2026-2027' },
      { code: 'CSC 516', title: 'Thesis/Dissertation', units: 6, level: '500', semester: 'Second', sessionName: '2026-2027' },
    ];

    console.log(`📚 Processing ${courses.length} courses...`);

    // Update or create each course
    let created = 0;
    let updated = 0;

    for (const courseData of courses) {
      const sessionId = sessionMap[courseData.sessionName];
      
      if (!sessionId) {
        console.error(`❌ Session ${courseData.sessionName} not found for course ${courseData.code}`);
        continue;
      }

      try {
        const course = await prisma.course.upsert({
          where: { code: courseData.code },
          update: {
            title: courseData.title,
            units: courseData.units,
            level: courseData.level,
            semester: courseData.semester,
            sessionId: sessionId,
            lecturerId: lecturer.id, // Ensure lecturer is set
          },
          create: {
            code: courseData.code,
            title: courseData.title,
            units: courseData.units,
            level: courseData.level,
            semester: courseData.semester,
            sessionId: sessionId,
            lecturerId: lecturer.id,
          },
        });

        if (course.createdAt.getTime() === course.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error: any) {
        console.error(`❌ Error processing course ${courseData.code}:`, error.message);
      }
    }

    console.log(`\n✅ Course update complete!`);
    console.log(`   Created: ${created} courses`);
    console.log(`   Updated: ${updated} courses`);
    console.log(`   Total: ${created + updated} courses processed`);

  } catch (error: any) {
    console.error('❌ Error updating courses:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateCourses()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

