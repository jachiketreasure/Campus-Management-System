import { prisma } from '@cms/database';
import { randomBytes, createHash } from 'crypto';
import { retryDbOperation } from '../utils/db-retry';

export type ClassType = 'PHYSICAL' | 'ONLINE';
export type AttendanceCheckInMethod = 'QR_SCAN' | 'CODE_ENTRY';

export type CreatePhysicalClassInput = {
  courseId: string;
  scheduledAt: string;
  duration: number; // in minutes
  venue: string;
};

export type CreateOnlineClassInput = {
  courseId: string;
  classTitle: string;
  scheduledAt: string;
  duration: number; // in minutes
  meetingPlatform: string; // Zoom, Google Meet, Teams, etc.
  meetingLink: string;
};

export type ClassSessionDTO = {
  id: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  lecturerId: string;
  lecturerName?: string;
  scheduledAt: string;
  duration: number;
  endsAt: string;
  classType: ClassType;
  status: 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  // Physical class fields
  venue?: string;
  // Online class fields
  classTitle?: string;
  meetingPlatform?: string;
  meetingLink?: string; // Only visible when class has started
  // QR Code fields
  qrToken?: string | null;
  qrTokenHash?: string | null;
  qrExpiresAt?: string | null;
  qrGeneratedAt?: string | null;
  // Attendance code fields
  attendanceCode?: string | null;
  codeExpiresAt?: string | null;
  // Status tracking
  classStartedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Generate a secure random attendance code (6-8 characters)
 */
function generateAttendanceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, I, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a secure QR token with hash
 */
function generateQrToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Create a physical (offline) class session
 */
export async function createPhysicalClass(
  lecturerId: string,
  input: CreatePhysicalClassInput
): Promise<ClassSessionDTO> {
  // Verify lecturer is assigned to this course
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    include: {
      session: true,
    },
  });

  if (!course) {
    throw new Error(`Course with ID ${input.courseId} not found`);
  }

  if (!course.sessionId || !course.semester) {
    throw new Error(`Course ${course.code} is missing session or semester information`);
  }

  // Check if lecturer is assigned to this course
  const assignment = await prisma.lecturerCourseAssignment.findFirst({
    where: {
      lecturerId,
      courseId: course.id,
      sessionId: course.sessionId,
      semester: course.semester,
      status: 'ACTIVE',
    },
  });

  if (!assignment) {
    throw new Error(
      `You are not assigned to teach ${course.code} for the current semester. ` +
      `Please assign yourself to this course first from the Courses page.`
    );
  }

  const scheduledAt = new Date(input.scheduledAt);
  const endsAt = new Date(scheduledAt.getTime() + input.duration * 60 * 1000);

  // Generate attendance code
  const attendanceCode = generateAttendanceCode();

  // Generate QR token and hash
  const { token: qrToken, hash: qrTokenHash } = generateQrToken();

  const session = await retryDbOperation(() =>
    prisma.attendanceSession.create({
      data: {
        courseId: input.courseId,
        lecturerId,
        scheduledAt,
        duration: input.duration,
        endsAt,
        mode: 'QR',
        classType: 'PHYSICAL',
        status: 'SCHEDULED',
        venue: input.venue,
        attendanceCode,
        codeExpiresAt: endsAt,
        qrToken,
        qrTokenHash,
        qrExpiresAt: endsAt,
        qrGeneratedAt: new Date(),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        lecturer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })
  );

  return mapSession(session);
}

/**
 * Create an online class session
 */
export async function createOnlineClass(
  lecturerId: string,
  input: CreateOnlineClassInput
): Promise<ClassSessionDTO> {
  // Verify lecturer is assigned to this course
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    include: {
      session: true,
    },
  });

  if (!course) {
    throw new Error(`Course with ID ${input.courseId} not found`);
  }

  if (!course.sessionId || !course.semester) {
    throw new Error(`Course ${course.code} is missing session or semester information`);
  }

  // Check if lecturer is assigned to this course
  const assignment = await prisma.lecturerCourseAssignment.findFirst({
    where: {
      lecturerId,
      courseId: course.id,
      sessionId: course.sessionId,
      semester: course.semester,
      status: 'ACTIVE',
    },
  });

  if (!assignment) {
    throw new Error(
      `You are not assigned to teach ${course.code} for the current semester. ` +
      `Please assign yourself to this course first from the Courses page.`
    );
  }

  const scheduledAt = new Date(input.scheduledAt);
  const endsAt = new Date(scheduledAt.getTime() + input.duration * 60 * 1000);

  // Generate attendance code
  const attendanceCode = generateAttendanceCode();

  // Generate QR token and hash
  const { token: qrToken, hash: qrTokenHash } = generateQrToken();

  const session = await retryDbOperation(() =>
    prisma.attendanceSession.create({
      data: {
        courseId: input.courseId,
        lecturerId,
        scheduledAt,
        duration: input.duration,
        endsAt,
        mode: 'QR',
        classType: 'ONLINE',
        status: 'SCHEDULED',
        classTitle: input.classTitle,
        meetingPlatform: input.meetingPlatform,
        meetingLink: input.meetingLink,
        attendanceCode,
        codeExpiresAt: endsAt,
        qrToken,
        qrTokenHash,
        qrExpiresAt: endsAt,
        qrGeneratedAt: new Date(),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        lecturer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })
  );

  return mapSession(session);
}

/**
 * Regenerate QR code for a class session
 */
export async function regenerateQrCode(sessionId: string, lecturerId: string): Promise<ClassSessionDTO> {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      course: {
        select: {
          code: true,
          title: true,
        },
      },
      lecturer: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error('Class session not found');
  }

  if (session.lecturerId !== lecturerId) {
    throw new Error('You are not authorized to regenerate QR code for this class');
  }

  if (session.status === 'CLOSED' || session.status === 'CANCELLED') {
    throw new Error('Cannot regenerate QR code for a closed or cancelled class');
  }

  // Generate new QR token and hash
  const { token: qrToken, hash: qrTokenHash } = generateQrToken();

  // Set expiration to when class ends
  const expiresAt = session.endsAt || new Date(session.scheduledAt.getTime() + (session.duration || 60) * 60 * 1000);

  const updated = await retryDbOperation(() =>
    prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        qrToken,
        qrTokenHash,
        qrExpiresAt: expiresAt,
        qrGeneratedAt: new Date(),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        lecturer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })
  );

  return mapSession(updated);
}

/**
 * Get QR code data for a session (for lecturer display)
 */
export async function getQrCodeData(sessionId: string, lecturerId: string): Promise<{
  qrData: string;
  attendanceCode: string;
  expiresAt: string;
}> {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error('Class session not found');
  }

  if (session.lecturerId !== lecturerId) {
    throw new Error('You are not authorized to view QR code for this class');
  }

  if (!session.qrToken || !session.attendanceCode) {
    throw new Error('QR code or attendance code not generated for this session');
  }

  // Build QR code data payload
  const qrPayload = {
    sessionId: session.id,
    lecturerId: session.lecturerId,
    courseId: session.courseId,
    scheduledAt: session.scheduledAt.toISOString(),
    token: session.qrToken,
    hash: session.qrTokenHash,
  };

  return {
    qrData: JSON.stringify(qrPayload),
    attendanceCode: session.attendanceCode,
    expiresAt: session.qrExpiresAt?.toISOString() || session.endsAt?.toISOString() || '',
  };
}

/**
 * Verify and process QR scan attendance
 */
export async function scanQrAttendance(
  studentId: string,
  qrData: string
): Promise<{ success: boolean; message: string; sessionId?: string }> {
  try {
    const payload = JSON.parse(qrData);
    const { sessionId, token, hash } = payload;

    if (!sessionId || !token || !hash) {
      return { success: false, message: 'Invalid QR code format' };
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    });

    if (!session) {
      return { success: false, message: 'Class session not found' };
    }

    // Verify token hash
    const expectedHash = createHash('sha256').update(token).digest('hex');
    if (hash !== expectedHash || session.qrTokenHash !== hash) {
      return { success: false, message: 'Invalid or expired QR code' };
    }

    // Check if QR token matches
    if (session.qrToken !== token) {
      return { success: false, message: 'QR code has been regenerated. Please scan the latest code.' };
    }

    // Check if class is active
    const now = new Date();
    if (now < session.scheduledAt) {
      return { success: false, message: 'Class has not started yet' };
    }

    if (session.endsAt && now > session.endsAt) {
      return { success: false, message: 'Class has ended' };
    }

    // Check if QR token is expired
    if (session.qrExpiresAt && now > session.qrExpiresAt) {
      return { success: false, message: 'QR code has expired' };
    }

    // Verify student is registered in the course
    const studentCourse = await prisma.studentCourse.findFirst({
      where: {
        studentId,
        courseId: session.courseId,
      },
    });

    if (!studentCourse) {
      return { success: false, message: 'You are not registered for this course' };
    }

    // Mark attendance
    await retryDbOperation(() =>
      prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId,
          },
        },
        update: {
          status: 'PRESENT',
          mode: 'QR',
          checkInMethod: 'QR_SCAN',
          checkedInAt: new Date(),
        },
        create: {
          sessionId: session.id,
          studentId,
          status: 'PRESENT',
          mode: 'QR',
          checkInMethod: 'QR_SCAN',
          checkedInAt: new Date(),
        },
      })
    );

    return {
      success: true,
      message: `Attendance marked successfully for ${session.course?.code || 'class'}`,
      sessionId: session.id,
    };
  } catch (error: any) {
    console.error('Error scanning QR attendance:', error);
    return { success: false, message: error.message || 'Failed to process attendance' };
  }
}

/**
 * Verify and process attendance code entry
 */
export async function enterAttendanceCode(
  studentId: string,
  sessionId: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      course: {
        select: {
          code: true,
          title: true,
        },
      },
    },
  });

  if (!session) {
    return { success: false, message: 'Class session not found' };
  }

  // Verify code
  if (session.attendanceCode !== code.toUpperCase()) {
    return { success: false, message: 'Invalid attendance code' };
  }

  // Check if class is active
  const now = new Date();
  if (now < session.scheduledAt) {
    return { success: false, message: 'Class has not started yet' };
  }

  if (session.endsAt && now > session.endsAt) {
    return { success: false, message: 'Class has ended' };
  }

  // Check if code is expired
  if (session.codeExpiresAt && now > session.codeExpiresAt) {
    return { success: false, message: 'Attendance code has expired' };
  }

  // Verify student is registered in the course
  const studentCourse = await prisma.studentCourse.findFirst({
    where: {
      studentId,
      courseId: session.courseId,
    },
  });

  if (!studentCourse) {
    return { success: false, message: 'You are not registered for this course' };
  }

  // Mark attendance
  await retryDbOperation(() =>
    prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId,
        },
      },
      update: {
        status: 'PRESENT',
        mode: 'QR',
        checkInMethod: 'CODE_ENTRY',
        checkedInAt: new Date(),
      },
      create: {
        sessionId: session.id,
        studentId,
        status: 'PRESENT',
        mode: 'QR',
        checkInMethod: 'CODE_ENTRY',
        checkedInAt: new Date(),
      },
    })
  );

  return {
    success: true,
    message: `Attendance marked successfully for ${session.course?.code || 'class'}`,
  };
}

/**
 * List classes for a lecturer
 */
export async function listLecturerClasses(
  lecturerId: string,
  status?: 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED'
): Promise<ClassSessionDTO[]> {
  const sessions = await retryDbOperation(() =>
    prisma.attendanceSession.findMany({
      where: {
        lecturerId,
        ...(status ? { status } : {}),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        lecturer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    })
  );

  return (sessions as any[]).map(mapSession);
}

/**
 * Get class details with attendance summary
 */
export async function getClassDetails(sessionId: string, lecturerId: string): Promise<{
  class: ClassSessionDTO;
  attendance: {
    totalStudents: number;
    presentCount: number;
    qrScanCount: number;
    codeEntryCount: number;
    missedCount: number;
    records: Array<{
      studentId: string;
      studentName: string;
      status: string;
      checkInMethod: string;
      checkedInAt: string;
    }>;
  };
}> {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      course: {
        select: {
          code: true,
          title: true,
        },
      },
      lecturer: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      records: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new Error('Class session not found');
  }

  if (session.lecturerId !== lecturerId) {
    throw new Error('You are not authorized to view this class');
  }

  // Get all students registered for this course
  const enrolledStudents = await prisma.studentCourse.findMany({
    where: { courseId: session.courseId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const totalStudents = enrolledStudents.length;
  const presentCount = session.records.filter((r) => r.status === 'PRESENT').length;
  const qrScanCount = session.records.filter((r) => r.checkInMethod === 'QR_SCAN').length;
  const codeEntryCount = session.records.filter((r) => r.checkInMethod === 'CODE_ENTRY').length;
  const missedCount = totalStudents - presentCount;

  return {
    class: mapSession(session),
    attendance: {
      totalStudents,
      presentCount,
      qrScanCount,
      codeEntryCount,
      missedCount,
      records: session.records.map((record) => ({
        studentId: record.studentId,
        studentName: record.student.name,
        status: record.status,
        checkInMethod: record.checkInMethod || 'QR_SCAN',
        checkedInAt: record.checkedInAt.toISOString(),
      })),
    },
  };
}

/**
 * List student's classes and attendance
 */
export async function listStudentClasses(studentId: string): Promise<Array<{
  class: ClassSessionDTO;
  attendance?: {
    status: string;
    checkInMethod?: string;
    checkedInAt?: string;
  };
}>> {
  // Get all courses student is registered for
  const studentCourses = await prisma.studentCourse.findMany({
    where: { studentId },
    select: { courseId: true },
  });

  const courseIds = studentCourses.map((sc) => sc.courseId);

  if (courseIds.length === 0) {
    return [];
  }

  // Get all classes for these courses
  const sessions = await retryDbOperation(() =>
    prisma.attendanceSession.findMany({
      where: {
        courseId: { in: courseIds },
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        lecturer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        records: {
          where: { studentId },
          select: {
            status: true,
            checkInMethod: true,
            checkedInAt: true,
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    })
  );

  return sessions.map((session) => {
    const record = session.records[0];
    return {
      class: mapSession(session),
      attendance: record
        ? {
            status: record.status,
            checkInMethod: record.checkInMethod || undefined,
            checkedInAt: record.checkedInAt.toISOString(),
          }
        : session.endsAt && new Date() > session.endsAt
          ? { status: 'MISSED' }
          : undefined,
    };
  });
}

/**
 * Start a class (change status to OPEN and set classStartedAt)
 */
export async function startClass(sessionId: string, lecturerId: string): Promise<ClassSessionDTO> {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error('Class session not found');
  }

  if (session.lecturerId !== lecturerId) {
    throw new Error('You are not authorized to start this class');
  }

  if (session.status === 'CLOSED' || session.status === 'CANCELLED') {
    throw new Error('Cannot start a closed or cancelled class');
  }

  const updated = await retryDbOperation(() =>
    prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        status: 'OPEN',
        classStartedAt: new Date(),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        lecturer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })
  );

  return mapSession(updated);
}

/**
 * Close a class (change status to CLOSED and mark missed students)
 */
export async function closeClass(sessionId: string, lecturerId: string): Promise<ClassSessionDTO> {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      records: {
        select: { studentId: true },
      },
    },
  });

  if (!session) {
    throw new Error('Class session not found');
  }

  if (session.lecturerId !== lecturerId) {
    throw new Error('You are not authorized to close this class');
  }

  // Mark students who didn't check in as MISSED
  const enrolledStudents = await prisma.studentCourse.findMany({
    where: { courseId: session.courseId },
    select: { studentId: true },
  });

  const presentStudentIds = new Set(session.records.map((r) => r.studentId));

  const missedStudentIds = enrolledStudents
    .map((s) => s.studentId)
    .filter((id) => !presentStudentIds.has(id));

  // Create MISSED records for students who didn't check in
  if (missedStudentIds.length > 0) {
    await Promise.all(
      missedStudentIds.map((studentId) =>
        retryDbOperation(() =>
          prisma.attendanceRecord.upsert({
            where: {
              sessionId_studentId: {
                sessionId: session.id,
                studentId,
              },
            },
            update: {
              status: 'ABSENT',
            },
            create: {
              sessionId: session.id,
              studentId,
              status: 'ABSENT',
              mode: 'QR',
              checkInMethod: 'QR_SCAN',
              checkedInAt: new Date(),
            },
          })
        )
      )
    );
  }

  const updated = await retryDbOperation(() =>
    prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        lecturer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })
  );

  return mapSession(updated);
}

/**
 * Map database session to DTO
 */
function mapSession(session: any): ClassSessionDTO {
  return {
    id: session.id,
    courseId: session.courseId,
    courseCode: session.course?.code,
    courseTitle: session.course?.title,
    lecturerId: session.lecturerId,
    lecturerName: session.lecturer
      ? `${session.lecturer.firstName || ''} ${session.lecturer.lastName || ''}`.trim()
      : undefined,
    scheduledAt: session.scheduledAt.toISOString(),
    duration: session.duration || 60,
    endsAt: session.endsAt?.toISOString() || '',
    classType: session.classType || 'PHYSICAL',
    status: session.status,
    venue: session.venue || undefined,
    classTitle: session.classTitle || undefined,
    meetingPlatform: session.meetingPlatform || undefined,
    meetingLink:
      session.classType === 'ONLINE' && session.classStartedAt
        ? session.meetingLink || undefined
        : undefined, // Only show link when class has started
    qrToken: session.qrToken || null,
    qrTokenHash: session.qrTokenHash || null,
    qrExpiresAt: session.qrExpiresAt?.toISOString() || null,
    qrGeneratedAt: session.qrGeneratedAt?.toISOString() || null,
    attendanceCode: session.attendanceCode || null,
    codeExpiresAt: session.codeExpiresAt?.toISOString() || null,
    classStartedAt: session.classStartedAt?.toISOString() || null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

