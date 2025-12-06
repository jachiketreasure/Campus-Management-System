import { prisma } from './index';
import * as fs from 'fs';
import * as path from 'path';

const coursesDataPath = path.join(__dirname, '../extracted_courses.json');
const coursesData = JSON.parse(fs.readFileSync(coursesDataPath, 'utf-8'));

interface CourseData {
  session: string;
  currentLevel: string;
  semester: string;
  courses: Array<{
    courseCode: string;
    courseTitle: string;
    unit: number;
    courseType: string;
  }>;
}

async function seedAcademicSessions() {
  const sessions = [
    {
      name: '2022–2023',
      startDate: new Date('2022-09-01'),
      endDate: new Date('2023-08-31'),
      status: 'CLOSED' as const,
      isActive: false,
      registrationOpen: false
    },
    {
      name: '2023–2024',
      startDate: new Date('2023-09-01'),
      endDate: new Date('2024-08-31'),
      status: 'CLOSED' as const,
      isActive: false,
      registrationOpen: false
    },
    {
      name: '2024–2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-08-31'),
      status: 'ACTIVE' as const,
      isActive: true,
      registrationOpen: true
    }
  ];

  const sessionMap: Record<string, string> = {};

  for (const session of sessions) {
    const created = await prisma.academicSession.upsert({
      where: { name: session.name },
      update: {
        startDate: session.startDate,
        endDate: session.endDate,
        status: session.status,
        isActive: session.isActive,
        registrationOpen: session.registrationOpen
      },
      create: session
    });
    sessionMap[session.name] = created.id;
    console.log(`✓ Session ${session.name} (ID: ${created.id})`);
  }

  return sessionMap;
}

async function getDefaultLecturer() {
  // Try to find the lecturer user from seed
  let lecturer = await prisma.user.findUnique({
    where: { email: 'lecturer@example.edu' }
  });

  // If not found, try to find any user with LECTURER role
  if (!lecturer) {
    const lecturerRole = await prisma.role.findUnique({
      where: { name: 'LECTURER' }
    });

    if (lecturerRole) {
      const userRole = await prisma.userRole.findFirst({
        where: { roleId: lecturerRole.id },
        include: { user: true }
      });

      if (userRole) {
        lecturer = userRole.user;
      }
    }
  }

  // If still not found, try to find any admin user
  if (!lecturer) {
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' }
    });

    if (adminRole) {
      const userRole = await prisma.userRole.findFirst({
        where: { roleId: adminRole.id },
        include: { user: true }
      });

      if (userRole) {
        lecturer = userRole.user;
      }
    }
  }

  // If still not found, get the first user
  if (!lecturer) {
    lecturer = await prisma.user.findFirst({});
  }

  if (!lecturer) {
    throw new Error('No lecturer found. Please run the main seed script first to create users.');
  }

  console.log(`✓ Using lecturer: ${lecturer.email} (ID: ${lecturer.id})`);
  return lecturer;
}

function extractLevel(levelString: string): string {
  // Extract numeric level from "300 LEVEL" -> "300"
  const match = levelString.match(/(\d+)/);
  return match ? match[1] : '300';
}

function normalizeSemester(semester: string): string {
  // Convert "FIRST SEMESTER" -> "First", "SECOND SEMESTER" -> "Second"
  if (semester.toUpperCase().includes('FIRST')) {
    return 'First';
  } else if (semester.toUpperCase().includes('SECOND')) {
    return 'Second';
  }
  return semester;
}

async function seedCourses(sessionMap: Record<string, string>, lecturerId: string) {
  const courses = coursesData as CourseData[];
  let createdCount = 0;
  let updatedCount = 0;

  for (const sessionData of courses) {
    const sessionId = sessionMap[sessionData.session];
    if (!sessionId) {
      console.warn(`⚠ Warning: Session "${sessionData.session}" not found, skipping courses`);
      continue;
    }

    const level = extractLevel(sessionData.currentLevel);
    const semester = normalizeSemester(sessionData.semester);

    for (const course of sessionData.courses) {
      try {
        const courseData = {
          code: course.courseCode,
          title: course.courseTitle,
          description: `Course Type: ${course.courseType}`,
          units: course.unit,
          level: level,
          semester: semester,
          sessionId: sessionId,
          lecturerId: lecturerId
        };

        const existing = await prisma.course.findUnique({
          where: { code: course.courseCode }
        });

        if (existing) {
          await prisma.course.update({
            where: { code: course.courseCode },
            data: courseData
          });
          updatedCount++;
          console.log(`  ↻ Updated: ${course.courseCode} - ${course.courseTitle}`);
        } else {
          await prisma.course.create({
            data: courseData
          });
          createdCount++;
          console.log(`  ✓ Created: ${course.courseCode} - ${course.courseTitle}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error creating/updating ${course.courseCode}:`, error.message);
      }
    }
  }

  return { createdCount, updatedCount };
}

async function main() {
  console.log('⏳ Seeding courses from extracted_courses.json...\n');

  try {
    // Create or get academic sessions
    console.log('📅 Creating/updating academic sessions...');
    const sessionMap = await seedAcademicSessions();
    console.log('');

    // Get default lecturer
    console.log('👤 Finding default lecturer...');
    const lecturer = await getDefaultLecturer();
    console.log('');

    // Seed courses
    console.log('📚 Creating/updating courses...');
    const { createdCount, updatedCount } = await seedCourses(sessionMap, lecturer.id);
    console.log('');

    console.log(`✅ Course seeding complete!`);
    console.log(`   Created: ${createdCount} courses`);
    console.log(`   Updated: ${updatedCount} courses`);
    console.log(`   Total: ${createdCount + updatedCount} courses`);
  } catch (error: any) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

