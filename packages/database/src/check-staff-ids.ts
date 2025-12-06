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

async function checkStaffIds() {
  try {
    console.log('🔍 Checking staff identification numbers in database...\n');

    // Check total count
    const totalCount = await prisma.staffIdentificationPool.count();
    console.log(`📊 Total staff IDs in database: ${totalCount}`);

    // Check available count
    const availableCount = await prisma.staffIdentificationPool.count({
      where: { isUsed: false }
    });
    console.log(`✅ Available (unused) staff IDs: ${availableCount}`);

    // Check CMS/STAFF count
    const cmsStaffCount = await prisma.staffIdentificationPool.count({
      where: {
        staffIdentificationNumber: {
          startsWith: 'CMS/STAFF/',
        },
      },
    });
    console.log(`📋 CMS/STAFF IDs: ${cmsStaffCount}`);

    // Get a few examples
    const examples = await prisma.staffIdentificationPool.findMany({
      take: 5,
      orderBy: {
        staffIdentificationNumber: 'asc',
      },
      select: {
        staffIdentificationNumber: true,
        isUsed: true,
      },
    });

    console.log('\n📝 Sample staff IDs:');
    examples.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.staffIdentificationNumber} (${item.isUsed ? 'USED' : 'AVAILABLE'})`);
    });

    // Check for any non-CMS/STAFF IDs
    const nonCmsCount = await prisma.staffIdentificationPool.count({
      where: {
        NOT: {
          staffIdentificationNumber: {
            startsWith: 'CMS/STAFF/',
          },
        },
      },
    });
    if (nonCmsCount > 0) {
      console.log(`\n⚠️  Found ${nonCmsCount} staff IDs that don't start with CMS/STAFF/`);
    }

  } catch (error) {
    console.error('❌ Error checking staff IDs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkStaffIds()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });



