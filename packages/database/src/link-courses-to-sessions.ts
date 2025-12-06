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

// Course data with session mapping
const courseSessionMap: Record<string, { session: string; level: string; semester: string }> = {
  // 100 Level - 2022-2023
  'GST 103': { session: '2022-2023', level: '100', semester: 'First' },
  'GST 102': { session: '2022-2023', level: '100', semester: 'First' },
  'STA 101': { session: '2022-2023', level: '100', semester: 'First' },
  'GST 101': { session: '2022-2023', level: '100', semester: 'First' },
  'PHY 191/193': { session: '2022-2023', level: '100', semester: 'First' },
  'BIO 191': { session: '2022-2023', level: '100', semester: 'First' },
  'MAT 101': { session: '2022-2023', level: '100', semester: 'First' },
  'CSC 101': { session: '2022-2023', level: '100', semester: 'First' },
  'PHY 101': { session: '2022-2023', level: '100', semester: 'First' },
  'BIO 101': { session: '2022-2023', level: '100', semester: 'First' },
  'ICH 191': { session: '2022-2023', level: '100', semester: 'First' },
  'ICH 101': { session: '2022-2023', level: '100', semester: 'First' },
  'GST 105': { session: '2022-2023', level: '100', semester: 'First' },
  
  'CSC 112': { session: '2022-2023', level: '100', semester: 'Second' },
  'GST 107': { session: '2022-2023', level: '100', semester: 'Second' },
  'MAT 102': { session: '2022-2023', level: '100', semester: 'Second' },
  'BIO 102': { session: '2022-2023', level: '100', semester: 'Second' },
  'MAT 104': { session: '2022-2023', level: '100', semester: 'Second' },
  'CSC 102': { session: '2022-2023', level: '100', semester: 'Second' },
  'PHY 192': { session: '2022-2023', level: '100', semester: 'Second' },
  'GST 106': { session: '2022-2023', level: '100', semester: 'Second' },
  'BIO 192': { session: '2022-2023', level: '100', semester: 'Second' },
  'PHY 102': { session: '2022-2023', level: '100', semester: 'Second' },
  'GST 108': { session: '2022-2023', level: '100', semester: 'Second' },

  // 200 Level - 2023-2024
  'CSC 231': { session: '2023-2024', level: '200', semester: 'First' },
  'MAT 201': { session: '2023-2024', level: '200', semester: 'First' },
  'CSC 221B': { session: '2023-2024', level: '200', semester: 'First' },
  'GST 201': { session: '2023-2024', level: '200', semester: 'First' },
  'CSC 215B': { session: '2023-2024', level: '200', semester: 'First' },
  'STA 201': { session: '2023-2024', level: '200', semester: 'First' },
  'MAT 211B': { session: '2023-2024', level: '200', semester: 'First' },
  'CSC 217': { session: '2023-2024', level: '200', semester: 'First' },
  'CSC 213B': { session: '2023-2024', level: '200', semester: 'First' },
  'PHY 261B': { session: '2023-2024', level: '200', semester: 'First' },

  'CSC 216': { session: '2023-2024', level: '200', semester: 'Second' },
  'CSC 242B': { session: '2023-2024', level: '200', semester: 'Second' },
  'MAT 212': { session: '2023-2024', level: '200', semester: 'Second' },
  'MAT 202B': { session: '2023-2024', level: '200', semester: 'Second' },
  'CSC 204': { session: '2023-2024', level: '200', semester: 'Second' },
  'CSC 226': { session: '2023-2024', level: '200', semester: 'Second' },
  'PHY 262B': { session: '2023-2024', level: '200', semester: 'Second' },
  'CSC 232': { session: '2023-2024', level: '200', semester: 'Second' },

  // 300 Level - 2024-2025
  'CSC 313': { session: '2024-2025', level: '300', semester: 'First' },
  'CSC 321': { session: '2024-2025', level: '300', semester: 'First' },
  'CSC 303': { session: '2024-2025', level: '300', semester: 'First' },
  'GST 301': { session: '2024-2025', level: '300', semester: 'First' },
  'CSC 343': { session: '2024-2025', level: '300', semester: 'First' },
  'CSC 311B': { session: '2024-2025', level: '300', semester: 'First' },
  'STA 331': { session: '2024-2025', level: '300', semester: 'First' },
  'CSC 333B': { session: '2024-2025', level: '300', semester: 'First' },
  'CSC 325B': { session: '2024-2025', level: '300', semester: 'First' },
  'CSC 323': { session: '2024-2025', level: '300', semester: 'First' },

  'CSC 398': { session: '2024-2025', level: '300', semester: 'Second' },
};

async function linkCoursesToSessions() {
  console.log('🔗 Linking courses to their respective sessions...\n');

  try {
    // Get all sessions
    const sessions = await prisma.academicSession.findMany({
      select: { id: true, name: true },
    });

    const sessionMap = new Map(sessions.map(s => [s.name, s.id]));

    // Get all courses
    const courses = await prisma.course.findMany({
      select: { id: true, code: true, sessionId: true, level: true, semester: true },
    });

    let linked = 0;
    let updated = 0;
    let skipped = 0;

    // Process all courses in the map
    for (const [courseCode, mapping] of Object.entries(courseSessionMap)) {
      const sessionId = sessionMap.get(mapping.session);
      
      if (!sessionId) {
        console.log(`⚠️  Session "${mapping.session}" not found. Skipping course ${courseCode}`);
        skipped++;
        continue;
      }

      // Find course by code
      const course = courses.find(c => c.code === courseCode);
      
      if (!course) {
        console.log(`⚠️  Course ${courseCode} not found in database. Please seed courses first.`);
        skipped++;
        continue;
      }

      // Check if course needs updating
      const needsUpdate = 
        course.sessionId !== sessionId ||
        course.level !== mapping.level ||
        course.semester !== mapping.semester;

      if (needsUpdate) {
        await prisma.course.update({
          where: { id: course.id },
          data: {
            sessionId: sessionId,
            level: mapping.level,
            semester: mapping.semester,
          },
        });
        
        if (course.sessionId === null) {
          linked++;
          console.log(`✅ Linked ${course.code} to session ${mapping.session}`);
        } else {
          updated++;
          console.log(`🔄 Updated ${course.code} (${course.sessionId ? 'was in different session' : 'missing session'}) to session ${mapping.session}`);
        }
      } else {
        skipped++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Linked: ${linked} courses`);
    console.log(`   🔄 Updated: ${updated} courses`);
    console.log(`   ⏭️  Skipped: ${skipped} courses`);
    console.log(`\n✨ Done!`);

  } catch (error) {
    console.error('❌ Error linking courses to sessions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

linkCoursesToSessions()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

