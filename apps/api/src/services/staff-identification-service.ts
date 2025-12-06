import { prisma } from '@cms/database';

/**
 * Initialize the staff identification number pool with 91 numbers starting from CMS/STAFF/2025/0000001
 */
export async function initializeStaffIdentificationPool() {
  const currentYear = 2025;
  const startNumber = 1; // Start from 0000001
  const count = 91; // Total 91 numbers

  const staffIdentificationNumbers: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const number = startNumber + i;
    const paddedNumber = number.toString().padStart(7, '0');
    staffIdentificationNumbers.push(`CMS/STAFF/${currentYear}/${paddedNumber}`);
  }

  // Check if pool already exists
  const existingCount = await prisma.staffIdentificationPool.count();
  
  if (existingCount > 0) {
    console.log(`Staff identification number pool already initialized with ${existingCount} numbers`);
    return { initialized: false, count: existingCount };
  }

  // Create all staff identification numbers
  const createPromises = staffIdentificationNumbers.map(staffId =>
    prisma.staffIdentificationPool.create({
      data: {
        staffIdentificationNumber: staffId,
        isUsed: false,
      },
    })
  );

  await Promise.all(createPromises);

  console.log(`Initialized staff identification number pool with ${count} numbers`);
  return { initialized: true, count };
}

/**
 * Get all available (unused) staff identification numbers
 */
export async function getAvailableStaffIdentificationNumbers(): Promise<string[]> {
  const available = await prisma.staffIdentificationPool.findMany({
    where: {
      isUsed: false,
    },
    select: {
      staffIdentificationNumber: true,
    },
    orderBy: {
      staffIdentificationNumber: 'asc',
    },
  });

  return available.map((item) => item.staffIdentificationNumber);
}

/**
 * Mark a staff identification number as used
 */
export async function markStaffIdentificationNumberAsUsed(
  staffIdentificationNumber: string,
  usedBy: string
): Promise<boolean> {
  try {
    const updated = await prisma.staffIdentificationPool.updateMany({
      where: {
        staffIdentificationNumber: staffIdentificationNumber,
        isUsed: false, // Only update if not already used
      },
      data: {
        isUsed: true,
        usedBy: usedBy,
        usedAt: new Date(),
      },
    });

    return updated.count > 0;
  } catch (error) {
    console.error('Error marking staff identification number as used:', error);
    return false;
  }
}

/**
 * Check if a staff identification number is available
 */
export async function isStaffIdentificationNumberAvailable(
  staffIdentificationNumber: string
): Promise<boolean> {
  const poolItem = await prisma.staffIdentificationPool.findUnique({
    where: {
      staffIdentificationNumber: staffIdentificationNumber,
    },
    select: {
      isUsed: true,
    },
  });

  return poolItem ? !poolItem.isUsed : false;
}

/**
 * Get count of available staff identification numbers
 */
export async function getAvailableStaffIdentificationNumberCount(): Promise<number> {
  return prisma.staffIdentificationPool.count({
    where: {
      isUsed: false,
    },
  });
}

/**
 * Generate a random 6-character alphanumeric staff identification number
 * Format: 2 letters + 4 numbers (e.g., AG6785)
 */
function generateRandomStaffId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  const letter1 = letters[Math.floor(Math.random() * letters.length)];
  const letter2 = letters[Math.floor(Math.random() * letters.length)];
  const num1 = numbers[Math.floor(Math.random() * numbers.length)];
  const num2 = numbers[Math.floor(Math.random() * numbers.length)];
  const num3 = numbers[Math.floor(Math.random() * numbers.length)];
  const num4 = numbers[Math.floor(Math.random() * numbers.length)];
  
  return `${letter1}${letter2}${num1}${num2}${num3}${num4}`;
}

/**
 * Auto-generate new staff identification numbers when pool is running low
 * Generates random 6-character alphanumeric codes (2 letters + 4 numbers)
 */
export async function autoGenerateStaffIdentificationNumbers(
  threshold: number = 10,
  batchSize: number = 50
): Promise<{ generated: number; newCount: number }> {
  try {
    // Check current available count
    const availableCount = await getAvailableStaffIdentificationNumberCount();
    
    // If we have enough numbers, don't generate more
    if (availableCount >= threshold) {
      return { generated: 0, newCount: availableCount };
    }

    console.log(`[AUTO_GEN] Staff IDs running low (${availableCount} available). Generating ${batchSize} new IDs...`);

    // Get all existing staff IDs to avoid duplicates
    const existing = await prisma.staffIdentificationPool.findMany({
      select: {
        staffIdentificationNumber: true,
      },
    });
    const existingIds = new Set<string>(existing.map(item => item.staffIdentificationNumber));

    // Generate unique random staff IDs
    const staffIdentificationNumbers: string[] = [];
    const maxAttempts = batchSize * 100; // Prevent infinite loop
    let attempts = 0;

    while (staffIdentificationNumbers.length < batchSize && attempts < maxAttempts) {
      const newId = generateRandomStaffId();
      if (!existingIds.has(newId) && !staffIdentificationNumbers.includes(newId)) {
        staffIdentificationNumbers.push(newId);
        existingIds.add(newId);
      }
      attempts++;
    }

    if (staffIdentificationNumbers.length < batchSize) {
      console.warn(`[AUTO_GEN] Only generated ${staffIdentificationNumbers.length} unique staff IDs after ${attempts} attempts`);
    }

    // Create new staff identification numbers in database
    await prisma.staffIdentificationPool.createMany({
      data: staffIdentificationNumbers.map(staffId => ({
        staffIdentificationNumber: staffId,
        isUsed: false,
      })),
      skipDuplicates: true,
    });

    const newAvailableCount = await getAvailableStaffIdentificationNumberCount();
    console.log(`[AUTO_GEN] Generated ${staffIdentificationNumbers.length} new staff IDs. Total available: ${newAvailableCount}`);

    return { generated: staffIdentificationNumbers.length, newCount: newAvailableCount };
  } catch (error) {
    console.error('Error auto-generating staff identification numbers:', error);
    throw error;
  }
}

