import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';

export interface LecturerCourseAssignmentDTO {
  id: string;
  lecturerId: string;
  lecturerName: string;
  lecturerEmail: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  sessionId: string;
  sessionName: string;
  semester: string;
  status: string;
  assignedAt: string;
  notes?: string;
}

export interface AvailableCourseDTO {
  id: string;
  code: string;
  title: string;
  description?: string;
  units?: number;
  level?: string;
  semester?: string;
  sessionId?: string;
  sessionName?: string;
  isAssigned: boolean;
  assignedLecturerId?: string;
  assignedLecturerName?: string;
}

/**
 * Get all courses available for assignment in a specific session
 */
export async function getAvailableCoursesForAssignment(sessionId: string, semester?: string) {
  // Get all courses for this session
  const courses = await prisma.course.findMany({
    where: {
      sessionId: sessionId,
      ...(semester && { semester }),
    },
    include: {
      session: {
        select: {
          name: true,
        },
      },
      lecturerAssignments: {
        where: {
          sessionId: sessionId,
          status: 'ACTIVE',
          ...(semester && { semester }),
        },
        include: {
          lecturer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [
      { level: 'asc' },
      { semester: 'asc' },
      { code: 'asc' },
    ],
  });

  return (courses as any[]).map((course: any) => {
    const activeAssignment = (course.lecturerAssignments as any[]).find((a: any) => a.status === 'ACTIVE');
    return {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      units: course.units,
      level: course.level,
      semester: course.semester,
      sessionId: course.sessionId,
      sessionName: course.session?.name || '',
      isAssigned: !!activeAssignment,
      assignedLecturerId: activeAssignment?.lecturerId,
      assignedLecturerName: activeAssignment
        ? activeAssignment.lecturer.name
        : undefined,
    };
  });
}

/**
 * Get courses assigned to a specific lecturer for a session
 */
export async function getLecturerAssignedCourses(lecturerId: string, sessionId: string, semester?: string) {
  // Get assignments without lecturer relation to avoid null errors
  const assignments = await retryDbOperation(() =>
    prisma.lecturerCourseAssignment.findMany({
      where: {
        lecturerId,
        sessionId,
        status: 'ACTIVE',
        ...(semester && { semester }),
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
            units: true,
            level: true,
            semester: true,
          },
        },
        session: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { semester: 'asc' },
        { course: { code: 'asc' } },
      ],
    })
  );

  // Fetch lecturer details (could be in Visitor or User model)
  const [visitorLecturer, userLecturer] = await Promise.all([
    retryDbOperation(() =>
      prisma.visitor.findUnique({
        where: { id: lecturerId },
        select: { id: true, name: true, email: true },
      })
    ),
    retryDbOperation(() =>
      prisma.user.findUnique({
        where: { id: lecturerId },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    ),
  ]);

  // Determine lecturer name and email
  const lecturerName = (visitorLecturer as any)?.name || 
    ((userLecturer as any) ? `${(userLecturer as any).firstName} ${(userLecturer as any).lastName}`.trim() : 'Unknown Lecturer');
  const lecturerEmail = (visitorLecturer as any)?.email || (userLecturer as any)?.email || '';

  return (assignments as any[]).map((assignment: any) => ({
    id: assignment.id,
    lecturerId: assignment.lecturerId,
    lecturerName,
    lecturerEmail,
    courseId: assignment.course.id,
    courseCode: assignment.course.code,
    courseTitle: assignment.course.title,
    sessionId: assignment.sessionId,
    sessionName: assignment.session.name,
    semester: assignment.semester,
    status: assignment.status,
    assignedAt: assignment.assignedAt.toISOString(),
    notes: assignment.notes,
  }));
}

/**
 * Assign a lecturer to a course for a specific semester
 */
export async function assignLecturerToCourse(
  lecturerId: string,
  courseId: string,
  sessionId: string,
  semester: string,
  notes?: string
): Promise<LecturerCourseAssignmentDTO> {
  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      session: {
        select: { name: true },
      },
    },
  });

  if (!course) {
    throw new Error('Course not found');
  }

  // Check if lecturer exists and is a lecturer
  const lecturer = await prisma.visitor.findUnique({
    where: { id: lecturerId },
    select: {
      id: true,
      name: true,
      email: true,
      visitorType: true,
    },
  });

  if (!lecturer) {
    throw new Error('Lecturer not found');
  }

  if (lecturer.visitorType !== 'LECTURER') {
    throw new Error('User is not a lecturer');
  }

  // Check if assignment already exists
  const existing = await prisma.lecturerCourseAssignment.findFirst({
    where: {
      courseId,
      sessionId,
      semester,
      status: 'ACTIVE',
    },
  });

  if (existing) {
      if (existing.lecturerId === lecturerId) {
        // Already assigned to this lecturer
        const lecturer = await prisma.visitor.findUnique({
          where: { id: lecturerId },
          select: {
            name: true,
            email: true,
          },
        });

        return {
          id: existing.id,
          lecturerId: existing.lecturerId,
          lecturerName: lecturer?.name || '',
          lecturerEmail: lecturer?.email || '',
          courseId: existing.courseId,
          courseCode: course.code,
          courseTitle: course.title,
          sessionId: existing.sessionId,
          sessionName: course.session?.name || '',
          semester: existing.semester,
          status: existing.status,
          assignedAt: existing.assignedAt.toISOString(),
          notes: existing.notes,
        };
      } else {
      throw new Error(`This course is already assigned to another lecturer for ${semester} semester`);
    }
  }

  // Create new assignment
  const assignment = await prisma.lecturerCourseAssignment.create({
    data: {
      lecturerId,
      courseId,
      sessionId,
      semester,
      status: 'ACTIVE',
      notes,
    },
    include: {
      lecturer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      course: true,
      session: {
        select: { name: true },
      },
    },
  });

  return {
    id: assignment.id,
    lecturerId: assignment.lecturerId,
    lecturerName: assignment.lecturer.name,
    lecturerEmail: assignment.lecturer.email,
    courseId: assignment.courseId,
    courseCode: assignment.course.code,
    courseTitle: assignment.course.title,
    sessionId: assignment.sessionId,
    sessionName: assignment.session.name,
    semester: assignment.semester,
    status: assignment.status,
    assignedAt: assignment.assignedAt.toISOString(),
    notes: assignment.notes,
  };
}

/**
 * Remove lecturer assignment from a course
 */
export async function removeLecturerAssignment(assignmentId: string, lecturerId: string) {
  const assignment = await prisma.lecturerCourseAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.lecturerId !== lecturerId) {
    throw new Error('You can only remove your own assignments');
  }

  await prisma.lecturerCourseAssignment.update({
    where: { id: assignmentId },
    data: {
      status: 'INACTIVE',
    },
  });
}

/**
 * Get lecturer assigned to a course for a specific semester
 */
export async function getCourseLecturer(courseId: string, sessionId: string, semester: string) {
  const assignment = await prisma.lecturerCourseAssignment.findFirst({
    where: {
      courseId,
      sessionId,
      semester,
      status: 'ACTIVE',
    },
        include: {
          lecturer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
  });

  if (!assignment) {
    return null;
  }

  return {
    id: assignment.lecturer.id,
    name: assignment.lecturer.name,
    email: assignment.lecturer.email,
  };
}

/**
 * Verify if a lecturer is assigned to a course for a semester
 */
export async function verifyLecturerAssignment(
  lecturerId: string,
  courseId: string,
  sessionId: string,
  semester: string
): Promise<boolean> {
  const assignment = await prisma.lecturerCourseAssignment.findFirst({
    where: {
      lecturerId,
      courseId,
      sessionId,
      semester,
      status: 'ACTIVE',
    },
  });

  return !!assignment;
}

