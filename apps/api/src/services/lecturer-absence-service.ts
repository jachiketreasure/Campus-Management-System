import { prisma } from '@cms/database';
import { randomUUID } from 'crypto';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export type LecturerAbsenceDTO = {
  id: string;
  courseId: string;
  lecturerId: string;
  sessionId: string;
  semester: string;
  absenceDate: string;
  reportedBy: string;
  reason?: string | null;
  confirmed: boolean;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    code: string;
    title: string;
  };
  lecturer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type LecturerAbsenceRecord = {
  id: string;
  courseId: string;
  lecturerId: string;
  sessionId: string;
  semester: string;
  absenceDate: Date | string;
  reportedBy: string;
  reason: string | null;
  confirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  course?: {
    id: string;
    code: string;
    title: string;
  };
  lecturer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

const toDTO = (absence: LecturerAbsenceRecord): LecturerAbsenceDTO => ({
  id: absence.id,
  courseId: absence.courseId,
  lecturerId: absence.lecturerId,
  sessionId: absence.sessionId,
  semester: absence.semester,
  absenceDate: absence.absenceDate instanceof Date ? absence.absenceDate.toISOString() : absence.absenceDate,
  reportedBy: absence.reportedBy,
  reason: absence.reason ?? undefined,
  confirmed: absence.confirmed,
  confirmedBy: absence.confirmedBy ?? undefined,
  confirmedAt: absence.confirmedAt instanceof Date ? absence.confirmedAt.toISOString() : absence.confirmedAt ?? undefined,
  createdAt: absence.createdAt instanceof Date ? absence.createdAt.toISOString() : absence.createdAt,
  updatedAt: absence.updatedAt instanceof Date ? absence.updatedAt.toISOString() : absence.updatedAt,
  ...(absence.course && { course: absence.course }),
  ...(absence.lecturer && { lecturer: absence.lecturer })
});

export type CreateLecturerAbsenceInput = {
  courseId: string;
  sessionId: string;
  semester: string;
  absenceDate: string;
  reason?: string;
};

/**
 * Report lecturer absence
 */
export async function reportLecturerAbsence(
  studentId: string,
  input: CreateLecturerAbsenceInput
): Promise<LecturerAbsenceDTO> {
  if (!usePrismaStore) {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      courseId: input.courseId,
      lecturerId: 'lecturer-id',
      sessionId: input.sessionId,
      semester: input.semester,
      absenceDate: input.absenceDate,
      reportedBy: studentId,
      reason: input.reason,
      confirmed: false,
      createdAt: now,
      updatedAt: now
    };
  }

  // Get course to find lecturer
  const course = await prisma.course.findUnique({
    where: { id: input.courseId }
  });

  if (!course) {
    const error = new Error('Course not found');
    Object.assign(error, { statusCode: 404 });
    throw error;
  }

  // Check if absence already reported for this date
  const existing = await prisma.lecturerAbsence.findFirst({
    where: {
      courseId: input.courseId,
      sessionId: input.sessionId,
      semester: input.semester,
      absenceDate: new Date(input.absenceDate)
    }
  });

  if (existing) {
    const error = new Error('Lecturer absence already reported for this date');
    Object.assign(error, { statusCode: 409 });
    throw error;
  }

  const absence = await prisma.lecturerAbsence.create({
    data: {
      courseId: input.courseId,
      lecturerId: course.lecturerId,
      sessionId: input.sessionId,
      semester: input.semester,
      absenceDate: new Date(input.absenceDate),
      reportedBy: studentId,
      reason: input.reason ?? null,
      confirmed: false
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true
        }
      },
      lecturer: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  return toDTO(absence as LecturerAbsenceRecord);
}

/**
 * Confirm lecturer absence (admin only)
 */
export async function confirmLecturerAbsence(
  absenceId: string,
  adminId: string
): Promise<LecturerAbsenceDTO | null> {
  if (!usePrismaStore) {
    return null;
  }

  const absence = await prisma.lecturerAbsence.update({
    where: { id: absenceId },
    data: {
      confirmed: true,
      confirmedBy: adminId,
      confirmedAt: new Date()
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true
        }
      },
      lecturer: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  // Recalculate attendance for all students in this course
  // This will be done asynchronously or via a background job
  // For now, we'll just return the updated absence

  return toDTO(absence as LecturerAbsenceRecord);
}

/**
 * Get lecturer absences for a course
 */
export async function getLecturerAbsences(
  courseId: string,
  sessionId: string,
  semester: string
): Promise<LecturerAbsenceDTO[]> {
  if (!usePrismaStore) {
    return [];
  }

  const absences = await prisma.lecturerAbsence.findMany({
    where: {
      courseId,
      sessionId,
      semester
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true
        }
      },
      lecturer: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      absenceDate: 'desc'
    }
  });

  return absences.map((absence) => toDTO(absence as LecturerAbsenceRecord));
}

