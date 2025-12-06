// Global type declarations to help with Prisma and unknown types
declare global {
  // Allow any property access on unknown types
  type AnyRecord = Record<string, any>;
  
  // Helper to cast unknown to any
  function asAny<T>(value: T): any {
    return value as any;
  }
}

// Make Prisma types more lenient
declare module '@prisma/client' {
  namespace Prisma {
    type JsonValue = any;
    type Decimal = number;
  }
}

export {};
