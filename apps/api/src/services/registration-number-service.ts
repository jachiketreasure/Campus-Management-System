import { prisma } from '@cms/database';

/**
 * Initialize the registration number pool with 91 numbers starting from CMS/2025/0000002
 */
export async function initializeRegistrationNumberPool() {
  const currentYear = 2025;
  const startNumber = 2; // Start from 0000002
  const count = 91; // Total 91 numbers

  const registrationNumbers: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const number = startNumber + i;
    const paddedNumber = number.toString().padStart(7, '0');
    registrationNumbers.push(`CMS/${currentYear}/${paddedNumber}`);
  }

  // Check if pool already exists
  const existingCount = await prisma.registrationNumberPool.count();
  
  if (existingCount > 0) {
    console.log(`Registration number pool already initialized with ${existingCount} numbers`);
    return { initialized: false, count: existingCount };
  }

  // Create all registration numbers
  const createPromises = registrationNumbers.map(regNumber =>
    prisma.registrationNumberPool.create({
      data: {
        registrationNumber: regNumber,
        isUsed: false,
      },
    })
  );

  await Promise.all(createPromises);

  console.log(`Initialized registration number pool with ${count} numbers`);
  return { initialized: true, count };
}

/**
 * Get all available (unused) registration numbers
 */
export async function getAvailableRegistrationNumbers(): Promise<string[]> {
  const available = await prisma.registrationNumberPool.findMany({
    where: {
      isUsed: false,
    },
    select: {
      registrationNumber: true,
    },
    orderBy: {
      registrationNumber: 'asc',
    },
  });

  return available.map((item) => item.registrationNumber);
}

/**
 * Mark a registration number as used
 */
export async function markRegistrationNumberAsUsed(
  registrationNumber: string,
  usedBy: string
): Promise<boolean> {
  try {
    const updated = await prisma.registrationNumberPool.updateMany({
      where: {
        registrationNumber: registrationNumber,
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
    console.error('Error marking registration number as used:', error);
    return false;
  }
}

/**
 * Check if a registration number is available
 */
export async function isRegistrationNumberAvailable(
  registrationNumber: string
): Promise<boolean> {
  const poolItem = await prisma.registrationNumberPool.findUnique({
    where: {
      registrationNumber: registrationNumber,
    },
    select: {
      isUsed: true,
    },
  });

  return poolItem ? !poolItem.isUsed : false;
}

/**
 * Get count of available registration numbers
 */
export async function getAvailableRegistrationNumberCount(): Promise<number> {
  return prisma.registrationNumberPool.count({
    where: {
      isUsed: false,
    },
  });
}

/**
 * Auto-generate new registration numbers when pool is running low
 * Generates numbers in the format: CMS/YYYY/NNNNNNN
 * Finds the highest number and continues from there
 */
export async function autoGenerateRegistrationNumbers(
  threshold: number = 10,
  batchSize: number = 50
): Promise<{ generated: number; newCount: number }> {
  try {
    // Check current available count
    const availableCount = await getAvailableRegistrationNumberCount();
    
    // If we have enough numbers, don't generate more
    if (availableCount >= threshold) {
      return { generated: 0, newCount: availableCount };
    }

    console.log(`[AUTO_GEN] Registration numbers running low (${availableCount} available). Generating ${batchSize} new numbers...`);

    // Find the highest registration number to continue from
    const allNumbers = await prisma.registrationNumberPool.findMany({
      where: {
        registrationNumber: {
          startsWith: 'CMS/',
        },
      },
      select: {
        registrationNumber: true,
      },
      orderBy: {
        registrationNumber: 'desc',
      },
      take: 1,
    });

    const currentYear = new Date().getFullYear();
    let startNumber = 2; // Default start

    // Extract the highest number from existing registration numbers
    if (allNumbers.length > 0) {
      const lastNumber = allNumbers[0].registrationNumber;
      // Format: CMS/YYYY/NNNNNNN
      const match = lastNumber.match(/CMS\/\d{4}\/(\d+)/);
      if (match) {
        const lastNum = parseInt(match[1], 10);
        startNumber = lastNum + 1;
      }
    }

    // Generate new registration numbers
    const registrationNumbers: string[] = [];
    const existingNumbers = new Set<string>();

    // Get all existing numbers to avoid duplicates
    const existing = await prisma.registrationNumberPool.findMany({
      select: {
        registrationNumber: true,
      },
    });
    existing.forEach(item => existingNumbers.add(item.registrationNumber));

    // Generate unique numbers
    let currentNumber = startNumber;
    while (registrationNumbers.length < batchSize) {
      const paddedNumber = currentNumber.toString().padStart(7, '0');
      const newRegNumber = `CMS/${currentYear}/${paddedNumber}`;
      
      if (!existingNumbers.has(newRegNumber)) {
        registrationNumbers.push(newRegNumber);
        existingNumbers.add(newRegNumber);
      }
      currentNumber++;
    }

    // Create new registration numbers in database
    await prisma.registrationNumberPool.createMany({
      data: registrationNumbers.map(regNumber => ({
        registrationNumber: regNumber,
        isUsed: false,
      })),
    });

    const newAvailableCount = await getAvailableRegistrationNumberCount();
    console.log(`[AUTO_GEN] Generated ${registrationNumbers.length} new registration numbers. Total available: ${newAvailableCount}`);

    return { generated: registrationNumbers.length, newCount: newAvailableCount };
  } catch (error) {
    console.error('Error auto-generating registration numbers:', error);
    throw error;
  }
}

