// Load environment variables BEFORE importing prisma
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables from apps/web/.env.local
const envPaths = [
  resolve(__dirname, '../../../apps/web/.env.local'),
  resolve(__dirname, '../../../apps/web/.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../../.env'),
];

for (const envPath of envPaths) {
  try {
    const result = config({ path: envPath });
    if (!result.error && process.env.DATABASE_URL) {
      console.log(`✅ Loaded DATABASE_URL from: ${envPath}`);
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

/**
 * Generate a random 6-character alphanumeric staff identification number
 * Format: 2 letters + 4 numbers (e.g., AG6785)
 */
function generateRandomStaffId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  // Generate 2 random letters
  const letter1 = letters[Math.floor(Math.random() * letters.length)];
  const letter2 = letters[Math.floor(Math.random() * letters.length)];
  
  // Generate 4 random numbers
  const num1 = numbers[Math.floor(Math.random() * numbers.length)];
  const num2 = numbers[Math.floor(Math.random() * numbers.length)];
  const num3 = numbers[Math.floor(Math.random() * numbers.length)];
  const num4 = numbers[Math.floor(Math.random() * numbers.length)];
  
  return `${letter1}${letter2}${num1}${num2}${num3}${num4}`;
}

/**
 * Migrate staff identification numbers from old format to new format
 */
async function migrateStaffIds() {
  try {
    console.log('🚀 Starting staff ID migration...\n');

    // Check current count
    const existingCount = await prisma.staffIdentificationPool.count();
    console.log(`📊 Current staff IDs in database: ${existingCount}`);

    // Check if any are used
    const usedCount = await prisma.staffIdentificationPool.count({
      where: { isUsed: true }
    });
    console.log(`🔒 Used staff IDs: ${usedCount}`);
    console.log(`✅ Available staff IDs: ${existingCount - usedCount}\n`);

    if (usedCount > 0) {
      console.log('⚠️  WARNING: Some staff IDs are currently in use!');
      console.log('   These will be deleted. Make sure no lecturers are using them.\n');
    }

    // Delete all existing staff IDs (both used and unused)
    console.log('🗑️  Deleting all existing staff IDs...');
    const deleteResult = await prisma.staffIdentificationPool.deleteMany({});
    console.log(`   Deleted ${deleteResult.count} staff IDs\n`);

    // Generate new random staff IDs
    const count = 91;
    const staffIdentificationNumbers: string[] = [];
    const usedIds = new Set<string>();
    
    console.log(`📝 Generating ${count} new random staff IDs...`);
    
    // Generate unique random staff IDs
    while (staffIdentificationNumbers.length < count) {
      const newId = generateRandomStaffId();
      if (!usedIds.has(newId)) {
        usedIds.add(newId);
        staffIdentificationNumbers.push(newId);
      }
    }

    // Create all new staff identification numbers
    console.log('💾 Saving new staff IDs to database...');
    await prisma.staffIdentificationPool.createMany({
      data: staffIdentificationNumbers.map(staffId => ({
        staffIdentificationNumber: staffId,
        isUsed: false,
      })),
    });

    console.log(`\n✅ Successfully migrated ${count} staff identification numbers!`);
    console.log(`📋 Sample IDs: ${staffIdentificationNumbers.slice(0, 10).join(', ')}...`);
    console.log(`\n✨ Migration complete!`);
  } catch (error) {
    console.error('❌ Error migrating staff IDs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateStaffIds()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });



