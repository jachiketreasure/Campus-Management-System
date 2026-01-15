import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// PrismaClient automatically reads DATABASE_URL from process.env
// which is set by the env.ts config loader in apps/api
// For MongoDB, we enhance the connection string with connection pool and timeout settings
const getDatabaseUrl = (): string => {
  const dbUrl = process.env.DATABASE_URL;
  
  // Debug logging
  console.log('[database] Checking DATABASE_URL...');
  console.log('[database] DATABASE_URL exists:', !!dbUrl);
  if (dbUrl) {
    // Mask credentials for security
    const maskedUrl = dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
    console.log('[database] DATABASE_URL value:', maskedUrl);
    
    // Check if database name is present
    const dbNameMatch = dbUrl.match(/\/([^/?]+)(\?|$)/);
    if (dbNameMatch) {
      console.log('[database] Database name detected:', dbNameMatch[1]);
    } else {
      console.error('[database] WARNING: No database name found in DATABASE_URL');
    }
  }
  
  if (!dbUrl) {
    console.error('[database] ERROR: DATABASE_URL environment variable is not set');
    console.error('[database] Make sure DATABASE_URL is in apps/web/.env.local or apps/web/.env');
    throw new Error('DATABASE_URL environment variable is not set. Please add it to apps/web/.env.local');
  }
  
  // If it's already a MongoDB connection string, ensure it has proper connection options
  if (dbUrl.startsWith('mongodb://') || dbUrl.startsWith('mongodb+srv://')) {
    try {
      // Parse the connection string carefully to preserve database name
      const url = new URL(dbUrl);
      
      // Check if database name exists in pathname
      const dbName = url.pathname.slice(1); // Remove leading '/'
      if (!dbName || dbName.trim().length === 0) {
        console.error('[database] ERROR: DATABASE_URL is missing database name. Pathname:', url.pathname);
        console.error('[database] Full URL (masked):', dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
        throw new Error('DATABASE_URL must include a database name after the host (e.g., /database-name)');
      }
      
      // Preserve existing query parameters and add new ones
      url.searchParams.set('retryWrites', 'true');
      url.searchParams.set('w', 'majority');
      // Increased timeouts for better reliability with replica sets
      url.searchParams.set('serverSelectionTimeoutMS', '30000');
      url.searchParams.set('connectTimeoutMS', '30000');
      url.searchParams.set('socketTimeoutMS', '60000');
      // Connection pool settings
      url.searchParams.set('maxPoolSize', '10');
      url.searchParams.set('minPoolSize', '2');
      url.searchParams.set('maxIdleTimeMS', '30000');
      // Retry settings
      url.searchParams.set('retryReads', 'true');
      // For MongoDB Atlas, ensure TLS is enabled
      if (url.protocol === 'mongodb+srv:') {
        url.searchParams.set('tls', 'true');
        url.searchParams.set('tlsAllowInvalidCertificates', 'false');
      }
      return url.toString();
    } catch (error) {
      // If URL parsing fails, log error and return original
      console.error('Error parsing DATABASE_URL:', error);
      console.error('DATABASE_URL value:', dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
      return dbUrl;
    }
  }
  
  return dbUrl;
};

// Lazy getter for database URL - only called when Prisma client is actually created
// This prevents errors during module import if DATABASE_URL isn't loaded yet
const getDatabaseUrlLazy = (): string => {
  try {
    return getDatabaseUrl();
  } catch (error: any) {
    // If DATABASE_URL isn't set during import, log warning but don't throw
    // It will be checked again when Prisma client is actually used
    console.warn('[database] DATABASE_URL not available during import:', error?.message);
    // Return a placeholder - the actual error will be thrown when Prisma tries to connect
    return process.env.DATABASE_URL || '';
  }
};

// Connection retry helper
const createPrismaClient = () => {
  const dbUrl = getDatabaseUrlLazy();
  
  // Final check - throw error if DATABASE_URL is still not set
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set. Please add it to your .env file.');
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
};

export const prisma =
  globalThis.__prisma ?? createPrismaClient();

// Handle connection lifecycle
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Connection health check and retry logic
let connectionRetries = 0;
const MAX_RETRIES = 3;

export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    // Test with a simple MongoDB query (list collections)
    await prisma.$runCommandRaw({ ping: 1 });
    connectionRetries = 0; // Reset retry counter on success
    return true;
  } catch (error: any) {
    console.error('[database] Connection check failed:', error?.message);
    return false;
  }
};

// Reconnect function
export const reconnectDatabase = async (): Promise<boolean> => {
  try {
    // Disconnect existing connection
    await prisma.$disconnect();
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reconnect
    await prisma.$connect();
    
    // Verify connection with MongoDB ping
    await prisma.$runCommandRaw({ ping: 1 });
    
    connectionRetries = 0;
    console.log('[database] Successfully reconnected to database');
    return true;
  } catch (error: any) {
    connectionRetries++;
    console.error(`[database] Reconnection attempt ${connectionRetries} failed:`, error?.message);
    
    if (connectionRetries >= MAX_RETRIES) {
      console.error('[database] Max reconnection attempts reached. Please check your database connection.');
      return false;
    }
    
    // Retry after exponential backoff
    await new Promise(resolve => setTimeout(resolve, 2000 * connectionRetries));
    return reconnectDatabase();
  }
};

// Helper to check if error is a connection error
const isConnectionError = (error: any): boolean => {
  const errorMessage = error?.message || String(error);
  return (
    errorMessage.includes('Server selection timeout') ||
    errorMessage.includes('No available servers') ||
    errorMessage.includes('I/O error') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND')
  );
};

// Wrapper for database operations with auto-retry
export const withRetry = async <T>(
  operation: () => Promise<T>,
  retries = 1
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (isConnectionError(error) && retries > 0) {
      console.log(`[database] Connection error, retrying... (${retries} attempts left)`);
      const reconnected = await reconnectDatabase();
      if (reconnected) {
        return await withRetry(operation, retries - 1);
      }
    }
    throw error;
  }
};

// Gracefully disconnect on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Initialize connection on module load
(async () => {
  try {
    await prisma.$connect();
    console.log('[database] Successfully connected to database');
  } catch (error: any) {
    console.error('[database] Initial connection failed:', error?.message);
    console.error('[database] Will attempt to reconnect on first query');
  }
})();

export * from '@prisma/client';

