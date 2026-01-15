import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';

/**
 * Get student's registered course IDs
 */
export async function getStudentRegisteredCourseIds(studentId: string): Promise<string[]> {
  const studentCourses = await retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      select: { courseId: true },
    })
  );

  return studentCourses.map(sc => sc.courseId);
}

/**
 * Get student's registered course codes
 */
export async function getStudentRegisteredCourseCodes(studentId: string): Promise<string[]> {
  const studentCourses = await retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      select: { courseCode: true },
    })
  );

  return studentCourses.map(sc => sc.courseCode);
}

/**
 * Check if student is registered for a specific course
 */
export async function isStudentRegisteredForCourse(
  studentId: string,
  courseId: string
): Promise<boolean> {
  const registration = await retryDbOperation(() =>
    prisma.studentCourse.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    })
  );

  return !!registration;
}

/**
 * Check if student is registered for a course by course code
 */
export async function isStudentRegisteredForCourseCode(
  studentId: string,
  courseCode: string
): Promise<boolean> {
  const registration = await retryDbOperation(() =>
    prisma.studentCourse.findFirst({
      where: {
        studentId,
        courseCode,
      },
    })
  );

  return !!registration;
}

/**
 * Filter assignments to only include those for student's registered courses
 */
export async function filterAssignmentsByStudentCourses(
  studentId: string,
  assignments: any[]
): Promise<any[]> {
  const registeredCourseIds = await getStudentRegisteredCourseIds(studentId);
  
  if (registeredCourseIds.length === 0) {
    return [];
  }

  return assignments.filter(assignment => 
    registeredCourseIds.includes(assignment.courseId)
  );
}

/**
 * Filter exams to only include those for student's registered courses
 */
export async function filterExamsByStudentCourses(
  studentId: string,
  exams: any[]
): Promise<any[]> {
  const registeredCourseCodes = await getStudentRegisteredCourseCodes(studentId);
  
  if (registeredCourseCodes.length === 0) {
    return [];
  }

  return exams.filter(exam => 
    registeredCourseCodes.includes(exam.courseCode)
  );
}

/**
 * Filter attendance records to only include those for student's registered courses
 */
export async function filterAttendanceRecordsByStudentCourses(
  studentId: string,
  records: any[]
): Promise<any[]> {
  const registeredCourseIds = await getStudentRegisteredCourseIds(studentId);
  
  if (registeredCourseIds.length === 0) {
    return [];
  }

  // Filter records where the session's courseId is in registered courses
  return records.filter(record => {
    const courseId = record.session?.courseId || record.courseId;
    return courseId && registeredCourseIds.includes(courseId);
  });
}

/**
 * Validate student can access a specific course material
 */
export async function validateStudentCourseAccess(
  studentId: string,
  courseId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const isRegistered = await isStudentRegisteredForCourse(studentId, courseId);
  
  if (!isRegistered) {
    return {
      allowed: false,
      reason: 'You are not registered for this course. Please register for the course to access its materials.',
    };
  }

  return { allowed: true };
}

/**
 * Validate student can access a course material by course code
 */
export async function validateStudentCourseCodeAccess(
  studentId: string,
  courseCode: string
): Promise<{ allowed: boolean; reason?: string }> {
  const isRegistered = await isStudentRegisteredForCourseCode(studentId, courseCode);
  
  if (!isRegistered) {
    return {
      allowed: false,
      reason: `You are not registered for course ${courseCode}. Please register for the course to access its materials.`,
    };
  }

  return { allowed: true };
}

