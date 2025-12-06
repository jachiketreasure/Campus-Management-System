import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
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

async function verifyCourses() {
  console.log('🔍 Verifying courses in database...\n');

  try {
    // Get all courses
    const allCourses = await prisma.course.findMany({
      select: {
        code: true,
        title: true,
        level: true,
        semester: true,
        units: true,
      },
      orderBy: { code: 'asc' },
    });

    console.log(`Total courses in database: ${allCourses.length}\n`);

    if (allCourses.length === 0) {
      console.log('❌ No courses found in database!');
      console.log('💡 Run: npm run seed:100-level --workspace @cms/database\n');
      return;
    }

    // Show all courses
    console.log('📚 All Courses:');
    allCourses.forEach((course, index) => {
      console.log(`  ${index + 1}. ${course.code} - ${course.title}`);
      console.log(`     Level: ${course.level || 'N/A'}, Semester: ${course.semester || 'N/A'}, Units: ${course.units || 'N/A'}`);
    });

    // Check 100 Level First Semester courses
    const courses100First = await prisma.course.findMany({
      where: {
        level: '100',
        semester: 'First',
      },
      select: {
        code: true,
        title: true,
        units: true,
      },
    });

    console.log(`\n✅ 100 Level First Semester courses: ${courses100First.length}`);
    if (courses100First.length > 0) {
      courses100First.forEach((course) => {
        console.log(`   - ${course.code}: ${course.title} (${course.units} units)`);
      });
    } else {
      console.log('   ❌ No courses found for 100 Level First Semester!');
    }

  } catch (error) {
    console.error('❌ Error verifying courses:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

verifyCourses();













