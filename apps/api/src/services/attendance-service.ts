import { prisma, type Prisma } from '@cms/database';
import { randomUUID } from 'crypto';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export type AttendanceSessionStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type AttendanceMode = 'QR' | 'BIOMETRIC' | 'DIGITAL';

export type AttendanceSessionDTO = {
  id: string;
  courseId: string;
  lecturerId: string;
  scheduledAt: string;
  mode: AttendanceMode;
  status: AttendanceSessionStatus;
  qrToken?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecordDTO = {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  mode: AttendanceMode;
  checkedInAt: string;
  location?: Record<string, unknown> | null;
};

export type CreateSessionInput = {
  courseId: string;
  scheduledAt: string;
  mode: AttendanceMode;
  status?: AttendanceSessionStatus;
  metadata?: Record<string, unknown>;
};

export type QrCheckinInput = {
  sessionId: string;
  token: string;
  studentId: string;
  location?: { lat: number; lng: number };
  device?: { id: string; platform: string };
};

const demoSessions: AttendanceSessionDTO[] = [
  {
    id: 'demo-session-1',
    courseId: 'course-csc401',
    lecturerId: 'demo-lecturer',
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    mode: 'QR',
    status: 'SCHEDULED',
    qrToken: 'demo-token-1',
    metadata: { location: 'Main Hall' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const demoRecords: AttendanceRecordDTO[] = [
  {
    id: 'demo-record-1',
    sessionId: 'demo-session-1',
    studentId: 'demo-student',
    status: 'PRESENT',
    mode: 'QR',
    checkedInAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    location: { lat: 0, lng: 0 }
  }
];

type SessionRecord = {
  id: string;
  courseId: string;
  lecturerId: string;
  scheduledAt: Date | string;
  mode: AttendanceMode;
  status: AttendanceSessionStatus;
  qrToken: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const mapSession = (session: SessionRecord): AttendanceSessionDTO => ({
  id: session.id,
  courseId: session.courseId,
  lecturerId: session.lecturerId,
  scheduledAt: session.scheduledAt instanceof Date ? session.scheduledAt.toISOString() : session.scheduledAt,
  mode: session.mode,
  status: session.status,
  qrToken: session.qrToken,
  metadata: (session.metadata as Record<string, unknown>) ?? null,
  createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt,
  updatedAt: session.updatedAt instanceof Date ? session.updatedAt.toISOString() : session.updatedAt
});

type RecordRow = {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  mode: AttendanceMode;
  checkedInAt: Date | string;
  location: Record<string, unknown> | null;
};

const mapRecord = (record: RecordRow): AttendanceRecordDTO => ({
  id: record.id,
  sessionId: record.sessionId,
  studentId: record.studentId,
  status: record.status,
  mode: record.mode,
  checkedInAt: record.checkedInAt instanceof Date ? record.checkedInAt.toISOString() : record.checkedInAt,
  location: (record.location as Record<string, unknown>) ?? null
});

export async function createSession(
  lecturerId: string,
  input: CreateSessionInput
): Promise<AttendanceSessionDTO> {
  // Verify lecturer is assigned to this course
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      code: true,
      semester: true,
      sessionId: true,
    },
  });

  if (!course) {
    throw new Error(`Course with ID ${input.courseId} not found`);
  }

  if (!course.sessionId || !course.semester) {
    throw new Error(`Course ${course.code} is missing session or semester information`);
  }

  // Check if lecturer is assigned to this course for this semester
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

  const payload = {
    courseId: input.courseId,
    lecturerId,
    scheduledAt: new Date(input.scheduledAt),
    mode: input.mode,
    status: input.status ?? 'SCHEDULED',
    metadata: input.metadata ?? null
  };

  if (usePrismaStore) {
    const session = await prisma.attendanceSession.create({
      data: {
        ...payload,
        metadata: payload.metadata
      }
    });
    return mapSession(session);
  }

  const session: AttendanceSessionDTO = {
    id: randomUUID(),
    courseId: payload.courseId,
    lecturerId,
    scheduledAt: payload.scheduledAt.toISOString(),
    mode: payload.mode,
    status: payload.status,
    qrToken: `demo-${Math.random().toString(36).slice(2, 8)}`,
    metadata: payload.metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  demoSessions.push(session);
  return session;
}

export async function listSessions(
  lecturerId: string,
  status?: AttendanceSessionStatus
): Promise<AttendanceSessionDTO[]> {
  if (usePrismaStore) {
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        lecturerId,
        ...(status ? { status } : {})
      },
      orderBy: { scheduledAt: 'desc' }
    });
    return sessions.map(mapSession);
  }

  return demoSessions
    .filter((session) => session.lecturerId === lecturerId && (!status || session.status === status))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

export async function listStudentRecords(studentId: string): Promise<AttendanceRecordDTO[]> {
  if (usePrismaStore) {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      orderBy: { checkedInAt: 'desc' }
    });
    return records.map(mapRecord);
  }

  return demoRecords
    .filter((record) => record.studentId === studentId)
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
}

export async function qrCheckIn(input: QrCheckinInput): Promise<AttendanceRecordDTO> {
  if (usePrismaStore) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: input.sessionId }
    });
    if (!session) {
      throw Object.assign(new Error('Session not found'), { statusCode: 404 });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: input.sessionId,
          studentId: input.studentId
        }
      },
      update: {
        status: 'PRESENT',
        mode: 'QR',
        checkedInAt: new Date(),
        location: input.location ?? null,
        deviceInfo: input.device ?? null
      },
      create: {
        sessionId: input.sessionId,
        studentId: input.studentId,
        status: 'PRESENT',
        mode: 'QR',
        checkedInAt: new Date(),
        location: input.location ?? null,
        deviceInfo: input.device ?? null
      }
    });

    return mapRecord(record);
  }

  const session = demoSessions.find((s) => s.id === input.sessionId);
  if (!session) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }

  const existingIndex = demoRecords.findIndex(
    (record) => record.sessionId === input.sessionId && record.studentId === input.studentId
  );
  const record: AttendanceRecordDTO = {
    id: existingIndex >= 0 ? demoRecords[existingIndex].id : randomUUID(),
    sessionId: input.sessionId,
    studentId: input.studentId,
    status: 'PRESENT',
    mode: 'QR',
    checkedInAt: new Date().toISOString(),
    location: input.location ?? null
  };

  if (existingIndex >= 0) {
    demoRecords[existingIndex] = record;
  } else {
    demoRecords.push(record);
  }

  return record;
}

