// Load environment variables BEFORE importing prisma
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables from apps/web/.env.local (where DATABASE_URL is typically stored)
// Try multiple possible locations
const envPaths = [
  resolve(__dirname, '../../../apps/web/.env.local'),
  resolve(__dirname, '../../../apps/web/.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../../.env'),
];

let loadedFrom = null;
for (const envPath of envPaths) {
  try {
    const result = config({ path: envPath });
    if (!result.error && process.env.DATABASE_URL) {
      loadedFrom = envPath;
      console.log(`✅ Loaded DATABASE_URL from: ${envPath}`);
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

// If still no DATABASE_URL, show helpful error
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Please ensure it is set in one of:');
  envPaths.forEach(path => console.error(`   - ${path}`));
  process.exit(1);
}

// Create Prisma client with the loaded DATABASE_URL
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
 * Initialize the staff identification number pool
 */
async function initializeStaffIds() {
  try {
    console.log('🚀 Initializing staff identification number pool...');

    // Check if pool already exists
    const existingCount = await prisma.staffIdentificationPool.count();
    
    if (existingCount > 0) {
      console.log(`✅ Staff identification number pool already exists with ${existingCount} numbers`);
      const availableCount = await prisma.staffIdentificationPool.count({
        where: { isUsed: false }
      });
      console.log(`📊 ${availableCount} staff IDs are currently available`);
      return;
    }

    // Initialize pool with staff identification numbers
    const count = 91; // Total 91 numbers
    const staffIdentificationNumbers: string[] = [];
    const usedIds = new Set<string>();
    
    // Generate unique random staff IDs
    while (staffIdentificationNumbers.length < count) {
      const newId = generateRandomStaffId();
      if (!usedIds.has(newId)) {
        usedIds.add(newId);
        staffIdentificationNumbers.push(newId);
      }
    }

    console.log(`📝 Creating ${count} staff identification numbers...`);

    // Create all staff identification numbers
    await prisma.staffIdentificationPool.createMany({
      data: staffIdentificationNumbers.map(staffId => ({
        staffIdentificationNumber: staffId,
        isUsed: false,
      })),
    });

    console.log(`✅ Successfully initialized ${count} staff identification numbers!`);
    console.log(`📋 Sample IDs: ${staffIdentificationNumbers.slice(0, 5).join(', ')}...`);
  } catch (error) {
    console.error('❌ Error initializing staff identification numbers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeStaffIds()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to initialize staff identification numbers:', error);
    process.exit(1);
  });

