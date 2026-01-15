import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';

export interface CourseWithAssignments {
  id: string;
  code: string;
  title: string;
  description?: string;
  units?: number;
  level?: string;
  semester?: string;
  sessionId?: string;
  sessionName?: string;
  assignedLecturers: {
    id: string;
    lecturerId: string;
    lecturerName: string;
    lecturerEmail: string;
    semester: string;
    status: string;
  }[];
}

export interface LecturerOption {
  id: string;
  name: string;
  email: string;
  visitorType: string;
}

/**
 * Get all active lecturers from both User model (with LECTURER role) and Visitor model
 */
export async function getAllActiveLecturers(): Promise<LecturerOption[]> {
  // Fetch lecturers from User model (admin-created users with LECTURER role)
  const userLecturers = await retryDbOperation(() =>
    prisma.user.findMany({
      where: {
        roleAssignments: {
          some: {
            role: {
              name: 'LECTURER',
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    })
  );

  // Fetch lecturers from Visitor model (legacy localStorage users)
  const visitorLecturers = await retryDbOperation(() =>
    prisma.visitor.findMany({
      where: {
        visitorType: 'LECTURER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        visitorType: true,
      },
      orderBy: {
        name: 'asc',
      },
    })
  );

  // Combine and format lecturers
  const combinedLecturers: LecturerOption[] = [
    // Format User model lecturers
    ...(userLecturers as any[]).map((user: any) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      visitorType: 'LECTURER',
    })),
    // Format Visitor model lecturers
    ...(visitorLecturers as any[]).map((visitor: any) => ({
      id: visitor.id,
      name: visitor.name,
      email: visitor.email,
      visitorType: visitor.visitorType,
    })),
  ];

  // Remove duplicates by email (in case same person exists in both models)
  const uniqueLecturers = Array.from(
    new Map(combinedLecturers.map((lecturer) => [lecturer.email, lecturer])).values()
  );

  // Sort by name
  return uniqueLecturers.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all courses for a session with their current assignments
 */
export async function getCoursesWithAssignments(sessionId: string, semester?: string): Promise<CourseWithAssignments[]> {
  // Build where clause for courses
  // Show courses that match the sessionId OR have no sessionId (unassigned courses)
  const baseWhere: any = {
    OR: [
      { sessionId: sessionId },
      { sessionId: null },
    ],
  };
  
  // If semester filter is provided, filter courses by semester
  // Only show courses that match the selected semester exactly
  let where: any = baseWhere;
  if (semester && semester.trim() !== '') {
    where = {
      AND: [
        baseWhere,
        { semester: semester.trim() },
      ],
    };
  }

  // Get courses with assignments (without lecturer relation to avoid null errors)
  const courses = await retryDbOperation(() =>
    prisma.course.findMany({
      where,
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
        },
      },
      orderBy: [
        { level: 'asc' },
        { semester: 'asc' },
        { code: 'asc' },
      ],
    })
  );

  // Collect all lecturer IDs to fetch in batch
  const lecturerIds = new Set<string>();
  (courses as any[]).forEach((course: any) => {
    (course.lecturerAssignments as any[]).forEach((assignment: any) => {
      lecturerIds.add(assignment.lecturerId);
    });
  });

  // Fetch all lecturers from both Visitor and User models in batch
  const [visitorLecturers, userLecturers] = await Promise.all([
    retryDbOperation(() =>
      prisma.visitor.findMany({
        where: {
          id: { in: Array.from(lecturerIds) },
          visitorType: 'LECTURER',
        },
        select: { id: true, name: true, email: true },
      })
    ),
    retryDbOperation(() =>
      prisma.user.findMany({
        where: {
          id: { in: Array.from(lecturerIds) },
          roleAssignments: {
            some: {
              role: {
                name: 'LECTURER',
              },
            },
          },
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    ),
  ]);

  // Create a map of lecturer ID to lecturer data
  const lecturerMap = new Map<string, { id: string; name: string; email: string }>();
  (visitorLecturers as any[]).forEach((lecturer: any) => {
    lecturerMap.set(lecturer.id, {
      id: lecturer.id,
      name: lecturer.name,
      email: lecturer.email,
    });
  });
  (userLecturers as any[]).forEach((lecturer: any) => {
    lecturerMap.set(lecturer.id, {
      id: lecturer.id,
      name: `${lecturer.firstName} ${lecturer.lastName}`.trim(),
      email: lecturer.email,
    });
  });

  // Map courses with lecturer data
  const coursesWithLecturers = (courses as any[]).map((course: any) => ({
    ...course,
    lecturerAssignments: (course.lecturerAssignments as any[])
      .filter((assignment: any) => lecturerMap.has(assignment.lecturerId)) // Only include assignments with valid lecturers
      .map((assignment: any) => ({
        ...assignment,
        lecturer: lecturerMap.get(assignment.lecturerId)!,
      })),
  }));

  return coursesWithLecturers.map((course) => ({
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    units: course.units,
    level: course.level,
    semester: course.semester,
    sessionId: course.sessionId,
    sessionName: course.session?.name || (course.sessionId === null ? 'Unassigned' : ''),
    isUnassigned: course.sessionId === null,
    assignedLecturers: course.lecturerAssignments.map((assignment: any) => ({
      id: assignment.id,
      lecturerId: assignment.lecturerId,
      lecturerName: assignment.lecturer.name,
      lecturerEmail: assignment.lecturer.email,
      semester: assignment.semester,
      status: assignment.status,
    })),
  }));
}

/**
 * Assign a single lecturer to a course for a specific semester
 * Only one lecturer can be assigned per course/session/semester
 */
export async function assignLecturerToCourse(
  courseId: string,
  sessionId: string,
  semester: string,
  lecturerId: string
): Promise<void> {
  // Validate course exists
  const course = await retryDbOperation(() =>
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        code: true,
        semester: true,
        sessionId: true,
      },
    })
  );

  if (!course) {
    throw new Error('Course not found');
  }

  // Update course sessionId if it's not set or different
  if ((course as any).sessionId !== sessionId) {
    await retryDbOperation(() =>
      prisma.course.update({
        where: { id: courseId },
        data: { sessionId: sessionId },
      })
    );
  }

  // Update course semester if it's not set or different
  if (!(course as any).semester || (course as any).semester !== semester) {
    await retryDbOperation(() =>
      prisma.course.update({
        where: { id: courseId },
        data: { semester: semester },
      })
    );
  }

  // Validate lecturer exists and is active (check both User and Visitor models)
  const [userLecturer, visitorLecturer] = await Promise.all([
    retryDbOperation(() =>
      prisma.user.findFirst({
        where: {
          id: lecturerId,
          roleAssignments: {
            some: {
              role: {
                name: 'LECTURER',
              },
            },
          },
        },
        select: { id: true },
      })
    ),
    retryDbOperation(() =>
      prisma.visitor.findFirst({
        where: {
          id: lecturerId,
          visitorType: 'LECTURER',
          status: 'ACTIVE',
        },
        select: { id: true },
      })
    ),
  ]);

  if (!userLecturer && !visitorLecturer) {
    throw new Error('Lecturer not found or inactive');
  }

  // Deactivate ALL existing assignments for this course/session/semester
  // This ensures only one lecturer is assigned at a time
  await retryDbOperation(() =>
    prisma.lecturerCourseAssignment.updateMany({
      where: {
        courseId,
        sessionId,
        semester,
        status: 'ACTIVE',
      },
      data: {
        status: 'INACTIVE',
      },
    })
  );

  // Check if assignment already exists (even if inactive)
  const existingAssignment = await retryDbOperation(() =>
    prisma.lecturerCourseAssignment.findFirst({
      where: {
        courseId,
        sessionId,
        semester,
        lecturerId,
      },
    })
  );

  if (existingAssignment) {
    // Reactivate the existing assignment
    await retryDbOperation(() =>
      prisma.lecturerCourseAssignment.update({
        where: { id: (existingAssignment as any).id },
        data: {
          status: 'ACTIVE',
        },
      })
    );
  } else {
    // Create new assignment
    await retryDbOperation(() =>
      prisma.lecturerCourseAssignment.create({
        data: {
          lecturerId,
          courseId,
          sessionId,
          semester,
          status: 'ACTIVE',
        },
      })
    ).catch((error: any) => {
      // Ignore duplicate key errors (in case of race conditions)
      if (error.code !== 'P2002') {
        throw error;
      }
    });
  }
}

/**
 * Remove lecturer assignment
 */
export async function removeLecturerAssignment(assignmentId: string): Promise<void> {
  await retryDbOperation(() =>
    prisma.lecturerCourseAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'INACTIVE',
      },
    })
  );
}

/**
 * Get assignments for a specific course
 */
export async function getCourseAssignments(courseId: string, sessionId: string, semester?: string) {
  const assignments = await retryDbOperation(() =>
    prisma.lecturerCourseAssignment.findMany({
      where: {
        courseId,
        sessionId,
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
        course: {
          select: {
            code: true,
            title: true,
          },
        },
        session: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    })
  );

  return (assignments as any[]).map((assignment: any) => ({
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
  }));
}

