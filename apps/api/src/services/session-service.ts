import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';
import { progressAllEligibleStudents } from './student-progression-service';
import bcrypt from 'bcryptjs';

export interface CreateSessionInput {
  name: string;
  startDate: string;
  endDate: string;
  status?: string;
  requiresPayment?: boolean;
  paymentAmount?: number;
  paymentCurrency?: string;
  isActive?: boolean;
  registrationOpen?: boolean;
}

export interface UpdateSessionInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  requiresPayment?: boolean;
  paymentAmount?: number;
  paymentCurrency?: string;
  isActive?: boolean;
  registrationOpen?: boolean;
}

export interface AcademicSessionDTO {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  requiresPayment: boolean;
  paymentAmount?: number;
  paymentCurrency?: string;
  isActive: boolean;
  registrationOpen: boolean;
}

export interface StudentSessionRegistrationDTO {
  id: string;
  studentId: string;
  sessionId: string;
  status: string;
  approvalType: string;
  paymentReference?: string;
  paymentVerified: boolean;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  session?: AcademicSessionDTO;
  student?: {
    id: string;
    name: string;
    email: string;
  };
}

export async function getAvailableSessions(): Promise<AcademicSessionDTO[]> {
  // Return ALL sessions (not filtered by registrationOpen) so students can see all available sessions
  // Optimized: Only select needed fields
  const sessions = await retryDbOperation(() =>
    prisma.academicSession.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        requiresPayment: true,
        paymentAmount: true,
        paymentCurrency: true,
        isActive: true,
        registrationOpen: true,
      },
      orderBy: { startDate: 'desc' },
      take: 50, // Limit results for performance
    })
  );

  return sessions.map((session) => ({
    id: session.id,
    name: session.name,
    startDate: session.startDate.toISOString(),
    endDate: session.endDate.toISOString(),
    status: session.status,
    requiresPayment: session.requiresPayment,
    paymentAmount: session.paymentAmount ? Number(session.paymentAmount) : undefined,
    paymentCurrency: session.paymentCurrency || undefined,
    isActive: session.isActive,
    registrationOpen: session.registrationOpen,
  }));
}

export async function getStudentSessionRegistration(
  studentId: string
): Promise<StudentSessionRegistrationDTO | null> {
  if (!prisma.studentSessionRegistration) {
    return null; // Model not available yet - Prisma client needs regeneration
  }

  // Check if student exists (as Visitor or User)
  const visitor = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: { id: true },
    })
  );

  // If student doesn't exist as Visitor, check if they exist as User
  // (but don't create Visitor here - that should happen during registration)
  if (!visitor) {
    const user = await retryDbOperation(() =>
      prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true },
      })
    );

    // If student doesn't exist at all, return null (no registration possible)
    if (!user) {
      return null;
    }
    // If student exists as User but not Visitor, they haven't registered for a session yet
    // Return null (this is expected for new students)
    return null;
  }

  const registration = await retryDbOperation(() =>
    prisma.studentSessionRegistration.findFirst({
      where: {
        studentId,
        status: { in: ['APPROVED', 'PAYMENT_VERIFIED'] },
      },
      include: {
        session: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  );

  if (!registration) {
    return null;
  }

  return {
    id: registration.id,
    studentId: registration.studentId,
    sessionId: registration.sessionId,
    status: registration.status,
    approvalType: registration.approvalType,
    paymentReference: registration.paymentReference || undefined,
    paymentVerified: registration.paymentVerified,
    approvedBy: registration.approvedBy || undefined,
    approvedAt: registration.approvedAt?.toISOString(),
    notes: registration.notes || undefined,
    session: registration.session
      ? {
          id: registration.session.id,
          name: registration.session.name,
          startDate: registration.session.startDate.toISOString(),
          endDate: registration.session.endDate.toISOString(),
          status: registration.session.status,
          requiresPayment: registration.session.requiresPayment,
          paymentAmount: registration.session.paymentAmount
            ? Number(registration.session.paymentAmount)
            : undefined,
          paymentCurrency: registration.session.paymentCurrency || undefined,
          isActive: registration.session.isActive,
          registrationOpen: registration.session.registrationOpen,
        }
      : undefined,
  };
}

export async function getStudentSessionRegistrationBySession(
  studentId: string,
  sessionId: string
): Promise<StudentSessionRegistrationDTO | null> {
  if (!prisma.studentSessionRegistration) {
    return null;
  }

  const registration = await retryDbOperation(() =>
    prisma.studentSessionRegistration.findUnique({
      where: {
        studentId_sessionId: {
          studentId,
          sessionId,
        },
      },
      include: {
        session: true,
      },
    })
  );

  if (!registration) {
    return null;
  }

  return {
    id: registration.id,
    studentId: registration.studentId,
    sessionId: registration.sessionId,
    status: registration.status,
    approvalType: registration.approvalType,
    paymentReference: registration.paymentReference || undefined,
    paymentVerified: registration.paymentVerified,
    approvedBy: registration.approvedBy || undefined,
    approvedAt: registration.approvedAt?.toISOString(),
    notes: registration.notes || undefined,
    session: registration.session
      ? {
          id: registration.session.id,
          name: registration.session.name,
          startDate: registration.session.startDate.toISOString(),
          endDate: registration.session.endDate.toISOString(),
          status: registration.session.status,
          requiresPayment: registration.session.requiresPayment,
          paymentAmount: registration.session.paymentAmount
            ? Number(registration.session.paymentAmount)
            : undefined,
          paymentCurrency: registration.session.paymentCurrency || undefined,
          isActive: registration.session.isActive,
          registrationOpen: registration.session.registrationOpen,
        }
      : undefined,
  };
}

export async function registerForSession(
  studentId: string,
  sessionId: string,
  paymentReference?: string
): Promise<StudentSessionRegistrationDTO> {
  console.log('[registerForSession] Starting registration:', { studentId, sessionId, paymentReference });
  
  if (!prisma.academicSession || !prisma.studentSessionRegistration) {
    const error = 'Prisma client not regenerated. Please run: cd packages/database && npm run generate';
    console.error('[registerForSession] Prisma client error:', error);
    throw new Error(error);
  }

  // Check if student exists as a Visitor
  let student;
  try {
    student = await retryDbOperation(() =>
      prisma.visitor.findUnique({
        where: { id: studentId },
        select: { id: true, visitorType: true, email: true },
      })
    );
    console.log('[registerForSession] Visitor lookup result:', { found: !!student, studentId });
  } catch (error: any) {
    console.error('[registerForSession] Error looking up Visitor:', error);
    throw new Error(`Failed to check student record: ${error.message || 'Unknown error'}`);
  }

  // If not found as Visitor, check if they exist as a User and create a Visitor record
  if (!student) {
    const user = await retryDbOperation(() =>
      prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, email: true, firstName: true, lastName: true, registrationNumber: true },
      })
    );

    if (user) {
      // Check if a Visitor with this email already exists
      const existingVisitor = await retryDbOperation(() =>
        prisma.visitor.findUnique({
          where: { email: user.email },
          select: { id: true, visitorType: true },
        })
      );

      if (existingVisitor) {
        // Use the existing Visitor ID
        student = existingVisitor;
      } else {
        // Create a Visitor record for this User
        // Generate a default password hash (user will need to reset password)
        const defaultPasswordHash = await bcrypt.hash('TempPassword123!', 10);
        
        try {
          student = await retryDbOperation(() =>
            prisma.visitor.create({
              data: {
                id: user.id, // Use same ID as User
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                passwordHash: defaultPasswordHash,
                visitorType: 'STUDENT',
                status: 'ACTIVE',
                registrationNumber: user.registrationNumber || null,
              },
              select: { id: true, visitorType: true, email: true },
            })
          );
        } catch (createError: any) {
          // If creation fails due to ID conflict, try to find the Visitor by email again
          if (createError.code === 'P2002') {
            const visitorByEmail = await retryDbOperation(() =>
              prisma.visitor.findUnique({
                where: { email: user.email },
                select: { id: true, visitorType: true, email: true },
              })
            );
            if (visitorByEmail) {
              student = visitorByEmail;
            } else {
              // ID conflict but email doesn't exist - this is unusual
              console.error('Failed to create Visitor due to ID conflict:', createError);
              throw new Error(`Failed to create student record. Please contact support.`);
            }
          } else {
            console.error('Error creating Visitor:', createError);
            throw new Error(`Failed to create student record: ${createError.message || 'Unknown error'}`);
          }
        }
      }
    } else {
      throw new Error(`Student with ID ${studentId} not found. Please ensure you are registered as a student.`);
    }
  }

  if (student.visitorType !== 'STUDENT') {
    throw new Error(`User with ID ${studentId} is not registered as a student.`);
  }

  // Use the actual Visitor ID (which might be different from the original studentId)
  const actualStudentId = student.id;
  console.log('[registerForSession] Using Visitor ID:', { originalStudentId: studentId, actualStudentId });

  // Check if session exists and is open for registration
  const session = await retryDbOperation(() =>
    prisma.academicSession.findUnique({
      where: { id: sessionId },
    })
  );

  if (!session) {
    throw new Error('Session not found');
  }

  // Allow registration even if registrationOpen is false, but log a warning
  // This provides more flexibility - admins can manually open registration later
  if (!session.registrationOpen) {
    console.warn(`Session ${sessionId} registration is not open, but allowing registration anyway`);
  }

  if (session.status !== 'ACTIVE' && session.status !== 'PENDING') {
    throw new Error(`Session is not available for registration. Current status: ${session.status}`);
  }

  // Check if student already has a registration for this session
  const existing = await retryDbOperation(() =>
    prisma.studentSessionRegistration.findUnique({
      where: {
        studentId_sessionId: {
          studentId: actualStudentId,
          sessionId,
        },
      },
    })
  );

  if (existing) {
    // Update existing registration - Auto-approve if conditions met
    const newStatus = session.requiresPayment
      ? paymentReference
        ? 'PAYMENT_VERIFIED' // Auto-approve if payment reference provided
        : existing.status === 'PAYMENT_VERIFIED' || existing.status === 'APPROVED'
        ? existing.status // Keep existing approved status
        : 'PAYMENT_PENDING'
      : 'APPROVED'; // Auto-approve if no payment required

    const updated = await retryDbOperation(() =>
      prisma.studentSessionRegistration.update({
        where: { id: existing.id },
        data: {
          paymentReference: paymentReference || existing.paymentReference,
          paymentVerified: paymentReference ? true : existing.paymentVerified,
          status: newStatus,
          approvedAt: (newStatus === 'APPROVED' || newStatus === 'PAYMENT_VERIFIED') && !existing.approvedAt
            ? new Date()
            : existing.approvedAt,
        },
        include: {
          session: true,
        },
      })
    );

    // Update visitor's current session if approved
    if (newStatus === 'APPROVED' || newStatus === 'PAYMENT_VERIFIED') {
      try {
        await retryDbOperation(() =>
          prisma.visitor.update({
            where: { id: actualStudentId },
            data: {
              currentSessionId: sessionId,
            },
          })
        );
      } catch (updateError: any) {
        // Log error but don't fail the registration update
        console.error(`Failed to update visitor currentSessionId for ${actualStudentId}:`, updateError);
        // Registration update was successful, so we continue
      }
    }

    return {
      id: updated.id,
      studentId: updated.studentId,
      sessionId: updated.sessionId,
      status: updated.status,
      approvalType: updated.approvalType,
      paymentReference: updated.paymentReference || undefined,
      paymentVerified: updated.paymentVerified,
      approvedBy: updated.approvedBy || undefined,
      approvedAt: updated.approvedAt?.toISOString(),
      notes: updated.notes || undefined,
      session: {
        id: updated.session.id,
        name: updated.session.name,
        startDate: updated.session.startDate.toISOString(),
        endDate: updated.session.endDate.toISOString(),
        status: updated.session.status,
        requiresPayment: updated.session.requiresPayment,
        paymentAmount: updated.session.paymentAmount
          ? Number(updated.session.paymentAmount)
          : undefined,
        paymentCurrency: updated.session.paymentCurrency || undefined,
        isActive: updated.session.isActive,
        registrationOpen: updated.session.registrationOpen,
      },
    };
  }

  // Create new registration - Auto-approve if no payment required, otherwise set to PAYMENT_VERIFIED if payment reference provided
  const registrationStatus = session.requiresPayment
    ? paymentReference
      ? 'PAYMENT_VERIFIED' // Auto-approve if payment reference provided
      : 'PAYMENT_PENDING'
    : 'APPROVED'; // Auto-approve if no payment required

  let registration;
  try {
    console.log('[registerForSession] Creating registration:', { 
      actualStudentId, 
      sessionId, 
      registrationStatus 
    });
    registration = await retryDbOperation(() =>
      prisma.studentSessionRegistration.create({
        data: {
          studentId: actualStudentId,
          sessionId,
          status: registrationStatus,
          approvalType: session.requiresPayment ? 'PAYMENT' : 'ADMIN',
          paymentReference: paymentReference || null,
          paymentVerified: paymentReference ? true : false,
          approvedAt: registrationStatus === 'APPROVED' || registrationStatus === 'PAYMENT_VERIFIED' ? new Date() : null,
        },
        include: {
          session: true,
        },
      })
    );
    console.log('[registerForSession] Registration created successfully:', { registrationId: registration.id });
  } catch (createError: any) {
    console.error('[registerForSession] Error creating registration:', {
      error: createError.message,
      code: createError.code,
      meta: createError.meta,
      actualStudentId,
      sessionId,
    });
    throw new Error(`Failed to create session registration: ${createError.message || 'Unknown error'}`);
  }

  // Update visitor's current session if approved
  if (registrationStatus === 'APPROVED' || registrationStatus === 'PAYMENT_VERIFIED') {
    try {
      await retryDbOperation(() =>
        prisma.visitor.update({
          where: { id: actualStudentId },
          data: {
            currentSessionId: sessionId,
          },
        })
      );
    } catch (updateError: any) {
      // Log error but don't fail the registration
      console.error(`Failed to update visitor currentSessionId for ${actualStudentId}:`, updateError);
      // Registration was successful, so we continue
    }
  }

  return {
    id: registration.id,
    studentId: registration.studentId,
    sessionId: registration.sessionId,
    status: registration.status,
    approvalType: registration.approvalType,
    paymentReference: registration.paymentReference || undefined,
    paymentVerified: registration.paymentVerified,
    approvedBy: registration.approvedBy || undefined,
    approvedAt: registration.approvedAt?.toISOString(),
    notes: registration.notes || undefined,
    session: {
      id: registration.session.id,
      name: registration.session.name,
      startDate: registration.session.startDate.toISOString(),
      endDate: registration.session.endDate.toISOString(),
      status: registration.session.status,
      requiresPayment: registration.session.requiresPayment,
      paymentAmount: registration.session.paymentAmount
        ? Number(registration.session.paymentAmount)
        : undefined,
      paymentCurrency: registration.session.paymentCurrency || undefined,
      isActive: registration.session.isActive,
      registrationOpen: registration.session.registrationOpen,
    },
  };
}

// Admin functions
export async function getAllSessions(): Promise<AcademicSessionDTO[]> {
  // Check if model exists (Prisma client might not be regenerated)
  if (!prisma.academicSession) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  // Optimized: Only select needed fields
  const sessions = await retryDbOperation(() =>
    prisma.academicSession.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        requiresPayment: true,
        paymentAmount: true,
        paymentCurrency: true,
        isActive: true,
        registrationOpen: true,
      },
      orderBy: { startDate: 'desc' },
      take: 100, // Limit results for performance
    })
  );

  return sessions.map((session) => ({
    id: session.id,
    name: session.name,
    startDate: session.startDate.toISOString(),
    endDate: session.endDate.toISOString(),
    status: session.status,
    requiresPayment: session.requiresPayment,
    paymentAmount: session.paymentAmount ? Number(session.paymentAmount) : undefined,
    paymentCurrency: session.paymentCurrency || undefined,
    isActive: session.isActive,
    registrationOpen: session.registrationOpen,
  }));
}

export async function createSession(data: CreateSessionInput): Promise<AcademicSessionDTO> {
  if (!prisma.academicSession) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  const session = await retryDbOperation(() =>
    prisma.academicSession.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: (data.status as any) || 'PENDING',
        requiresPayment: data.requiresPayment || false,
        paymentAmount: data.paymentAmount || null,
        paymentCurrency: data.paymentCurrency || 'NGN',
        isActive: data.isActive || false,
        registrationOpen: data.registrationOpen || false,
      },
    })
  );

  // Automatically progress eligible students to the next level when a new session is created
  // This runs in the background and doesn't block the response
  progressAllEligibleStudents(session.id).catch((error) => {
    console.error('Error progressing students for new session:', error);
    // Don't throw - this is a background operation
  });

  return {
    id: session.id,
    name: session.name,
    startDate: session.startDate.toISOString(),
    endDate: session.endDate.toISOString(),
    status: session.status,
    requiresPayment: session.requiresPayment,
    paymentAmount: session.paymentAmount ? Number(session.paymentAmount) : undefined,
    paymentCurrency: session.paymentCurrency || undefined,
    isActive: session.isActive,
    registrationOpen: session.registrationOpen,
  };
}

export async function updateSession(
  sessionId: string,
  data: UpdateSessionInput
): Promise<AcademicSessionDTO> {
  if (!prisma.academicSession) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  // Validate that session exists first
  const existingSession = await retryDbOperation(() =>
    prisma.academicSession.findUnique({
      where: { id: sessionId },
    })
  );

  if (!existingSession) {
    throw new Error('Session not found');
  }

  const updateData: any = {};

  if (data.name !== undefined && data.name !== null) updateData.name = data.name;
  if (data.startDate !== undefined && data.startDate !== null) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined && data.endDate !== null) updateData.endDate = new Date(data.endDate);
  
  // Always update status if it's provided - accept all valid status values
  // Handle both string and null/undefined cases
  if (data.status !== undefined && data.status !== null && data.status !== '') {
    const statusStr = String(data.status).trim().toUpperCase();
    const validStatuses = ['PENDING', 'ACTIVE', 'CLOSED', 'CANCELLED'];
    if (validStatuses.includes(statusStr)) {
      updateData.status = statusStr as any;
    } else {
      throw new Error(`Invalid status: ${data.status}. Valid statuses are: ${validStatuses.join(', ')}`);
    }
  }
  
  if (data.requiresPayment !== undefined) updateData.requiresPayment = data.requiresPayment;
  if (data.paymentAmount !== undefined) updateData.paymentAmount = data.paymentAmount ?? null;
  if (data.paymentCurrency !== undefined && data.paymentCurrency !== null) updateData.paymentCurrency = data.paymentCurrency;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.registrationOpen !== undefined) updateData.registrationOpen = data.registrationOpen;

  // Log the update for debugging
  console.log('Updating session:', { 
    sessionId, 
    updateData, 
    originalStatus: existingSession.status,
    hasStatusUpdate: updateData.status !== undefined
  });

  // Ensure we have at least one field to update
  if (Object.keys(updateData).length === 0) {
    throw new Error('No fields provided for update');
  }

  const session = await retryDbOperation(() =>
    prisma.academicSession.update({
      where: { id: sessionId },
      data: updateData,
    })
  );

  console.log('Session updated successfully:', { 
    sessionId, 
    oldStatus: existingSession.status,
    newStatus: session.status,
    allFields: Object.keys(updateData)
  });

  // If session status is being changed to ACTIVE, progress eligible students
  // This ensures students are automatically progressed when a session becomes active
  if (updateData.status === 'ACTIVE' && existingSession.status !== 'ACTIVE') {
    progressAllEligibleStudents(sessionId).catch((error) => {
      console.error('Error progressing students when session activated:', error);
      // Don't throw - this is a background operation
    });
  }

  return {
    id: session.id,
    name: session.name,
    startDate: session.startDate.toISOString(),
    endDate: session.endDate.toISOString(),
    status: session.status,
    requiresPayment: session.requiresPayment,
    paymentAmount: session.paymentAmount ? Number(session.paymentAmount) : undefined,
    paymentCurrency: session.paymentCurrency || undefined,
    isActive: session.isActive,
    registrationOpen: session.registrationOpen,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!prisma.academicSession) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  await retryDbOperation(() =>
    prisma.academicSession.delete({
      where: { id: sessionId },
    })
  );
}

export async function getAllSessionRegistrations(
  sessionId?: string,
  status?: string
): Promise<StudentSessionRegistrationDTO[]> {
  // Check if model exists (Prisma client might not be regenerated)
  if (!prisma.studentSessionRegistration) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  const where: any = {};
  if (sessionId) where.sessionId = sessionId;
  if (status) where.status = status;

  const registrations = await retryDbOperation(() =>
    prisma.studentSessionRegistration.findMany({
      where,
      include: {
        session: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  );

  return registrations.map((reg) => ({
    id: reg.id,
    studentId: reg.studentId,
    sessionId: reg.sessionId,
    status: reg.status,
    approvalType: reg.approvalType,
    paymentReference: reg.paymentReference || undefined,
    paymentVerified: reg.paymentVerified,
    approvedBy: reg.approvedBy || undefined,
    approvedAt: reg.approvedAt?.toISOString(),
    notes: reg.notes || undefined,
    session: {
      id: reg.session.id,
      name: reg.session.name,
      startDate: reg.session.startDate.toISOString(),
      endDate: reg.session.endDate.toISOString(),
      status: reg.session.status,
      requiresPayment: reg.session.requiresPayment,
      paymentAmount: reg.session.paymentAmount ? Number(reg.session.paymentAmount) : undefined,
      paymentCurrency: reg.session.paymentCurrency || undefined,
      isActive: reg.session.isActive,
      registrationOpen: reg.session.registrationOpen,
    },
    student: {
      id: reg.student.id,
      name: reg.student.name,
      email: reg.student.email,
    },
  } as any));
}

export async function approveSessionRegistration(
  registrationId: string,
  adminId: string,
  notes?: string
): Promise<StudentSessionRegistrationDTO> {
  if (!prisma.studentSessionRegistration) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  const registration = await retryDbOperation(() =>
    prisma.studentSessionRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
        notes: notes || null,
      },
      include: {
        session: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  );

  // Update visitor's current session
  await retryDbOperation(() =>
    prisma.visitor.update({
      where: { id: registration.studentId },
      data: {
        currentSessionId: registration.sessionId,
      },
    })
  );

  return {
    id: registration.id,
    studentId: registration.studentId,
    sessionId: registration.sessionId,
    status: registration.status,
    approvalType: registration.approvalType,
    paymentReference: registration.paymentReference || undefined,
    paymentVerified: registration.paymentVerified,
    approvedBy: registration.approvedBy || undefined,
    approvedAt: registration.approvedAt?.toISOString(),
    notes: registration.notes || undefined,
    session: {
      id: registration.session.id,
      name: registration.session.name,
      startDate: registration.session.startDate.toISOString(),
      endDate: registration.session.endDate.toISOString(),
      status: registration.session.status,
      requiresPayment: registration.session.requiresPayment,
      paymentAmount: registration.session.paymentAmount ? Number(registration.session.paymentAmount) : undefined,
      paymentCurrency: registration.session.paymentCurrency || undefined,
      isActive: registration.session.isActive,
      registrationOpen: registration.session.registrationOpen,
    },
    student: {
      id: registration.student.id,
      name: registration.student.name,
      email: registration.student.email,
    },
  } as any;
}

export async function rejectSessionRegistration(
  registrationId: string,
  adminId: string,
  notes?: string
): Promise<StudentSessionRegistrationDTO> {
  if (!prisma.studentSessionRegistration) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  const registration = await retryDbOperation(() =>
    prisma.studentSessionRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'REJECTED',
        approvedBy: adminId,
        approvedAt: new Date(),
        notes: notes || null,
      },
      include: {
        session: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  );

  return {
    id: registration.id,
    studentId: registration.studentId,
    sessionId: registration.sessionId,
    status: registration.status,
    approvalType: registration.approvalType,
    paymentReference: registration.paymentReference || undefined,
    paymentVerified: registration.paymentVerified,
    approvedBy: registration.approvedBy || undefined,
    approvedAt: registration.approvedAt?.toISOString(),
    notes: registration.notes || undefined,
    session: {
      id: registration.session.id,
      name: registration.session.name,
      startDate: registration.session.startDate.toISOString(),
      endDate: registration.session.endDate.toISOString(),
      status: registration.session.status,
      requiresPayment: registration.session.requiresPayment,
      paymentAmount: registration.session.paymentAmount ? Number(registration.session.paymentAmount) : undefined,
      paymentCurrency: registration.session.paymentCurrency || undefined,
      isActive: registration.session.isActive,
      registrationOpen: registration.session.registrationOpen,
    },
    student: {
      id: registration.student.id,
      name: registration.student.name,
      email: registration.student.email,
    },
  } as any;
}

export async function verifyPayment(
  registrationId: string,
  adminId: string,
  notes?: string
): Promise<StudentSessionRegistrationDTO> {
  if (!prisma.studentSessionRegistration) {
    throw new Error('Prisma client not regenerated. Please run: cd packages/database && npm run generate');
  }

  const registration = await retryDbOperation(() =>
    prisma.studentSessionRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'PAYMENT_VERIFIED',
        paymentVerified: true,
        approvedBy: adminId,
        approvedAt: new Date(),
        notes: notes || null,
      },
      include: {
        session: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  );

  // Update visitor's current session
  await retryDbOperation(() =>
    prisma.visitor.update({
      where: { id: registration.studentId },
      data: {
        currentSessionId: registration.sessionId,
      },
    })
  );

  return {
    id: registration.id,
    studentId: registration.studentId,
    sessionId: registration.sessionId,
    status: registration.status,
    approvalType: registration.approvalType,
    paymentReference: registration.paymentReference || undefined,
    paymentVerified: registration.paymentVerified,
    approvedBy: registration.approvedBy || undefined,
    approvedAt: registration.approvedAt?.toISOString(),
    notes: registration.notes || undefined,
    session: {
      id: registration.session.id,
      name: registration.session.name,
      startDate: registration.session.startDate.toISOString(),
      endDate: registration.session.endDate.toISOString(),
      status: registration.session.status,
      requiresPayment: registration.session.requiresPayment,
      paymentAmount: registration.session.paymentAmount ? Number(registration.session.paymentAmount) : undefined,
      paymentCurrency: registration.session.paymentCurrency || undefined,
      isActive: registration.session.isActive,
      registrationOpen: registration.session.registrationOpen,
    },
    student: {
      id: registration.student.id,
      name: registration.student.name,
      email: registration.student.email,
    },
  } as any;
}

