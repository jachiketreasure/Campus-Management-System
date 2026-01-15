import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';

/**
 * Get student's current academic level from their profile or history
 */
export async function getStudentCurrentLevel(studentId: string): Promise<string | null> {
  const student = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: {
        academicLevel: true,
        levelHistory: {
          orderBy: { assignedAt: 'desc' },
          take: 1,
          select: {
            level: true,
          },
        },
      },
    })
  );

  if (!student) {
    return null;
  }

  // Prefer academicLevel from Visitor, fallback to latest history
  return (student as any).academicLevel || (student as any).levelHistory?.[0]?.level || null;
}

/**
 * Get student's registration history to determine allowed progression
 */
export async function getStudentRegistrationHistory(studentId: string) {
  const history = await retryDbOperation(() =>
    prisma.studentLevelHistory.findMany({
      where: { studentId },
      include: {
        session: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    })
  );

  return history;
}

/**
 * Extract numeric level from level string (e.g., "200" from "200L" or "200 Level")
 */
function extractLevelNumber(level: string): number | null {
  const match = level?.replace(/[^0-9]/g, '');
  return match ? parseInt(match, 10) : null;
}

/**
 * Validate if student can register for a specific level
 * Rules:
 * 1. First-time students can only register for 100 level
 * 2. Students can only register for their current level or next level (if progressing)
 * 3. Students cannot register for lower levels (unless repeating, which requires admin approval)
 * 4. Students cannot skip levels (e.g., can't go from 100 to 300)
 */
export async function validateLevelRegistration(
  studentId: string,
  requestedLevel: string,
  sessionId: string
): Promise<{ allowed: boolean; reason?: string; allowedLevels?: string[] }> {
  // Get student's current level
  const currentLevel = await getStudentCurrentLevel(studentId);
  
  // If student has no level history, they can only register for 100 level
  if (!currentLevel) {
    const requestedLevelNum = extractLevelNumber(requestedLevel);
    if (requestedLevelNum === 100) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'New students can only register for 100 level. Please contact administration if you believe this is an error.',
      allowedLevels: ['100'],
    };
  }

  const currentLevelNum = extractLevelNumber(currentLevel);
  const requestedLevelNum = extractLevelNumber(requestedLevel);

  if (!currentLevelNum || !requestedLevelNum) {
    return {
      allowed: false,
      reason: 'Invalid level format. Please contact administration.',
    };
  }

  // Get registration history to check progression
  const history = await getStudentRegistrationHistory(studentId);
  
  // Check if student has completed current level (has registered for both semesters)
  // This is a simplified check - in a real system, you'd check course completion/grades
  const currentLevelRegistrations = history.filter(h => {
    const hLevelNum = extractLevelNumber(h.level);
    return hLevelNum === currentLevelNum;
  });

  // Allow registration if:
  // 1. Registering for current level (repeating or continuing)
  // 2. Registering for next level (progressing: 100->200, 200->300, etc.)
  // 3. Admin override (would need additional parameter)

  if (requestedLevelNum === currentLevelNum) {
    // Registering for current level - allowed (could be repeating or continuing)
    return { allowed: true };
  }

  if (requestedLevelNum === currentLevelNum + 100) {
    // Registering for next level - allowed (progressing)
    return { allowed: true };
  }

  if (requestedLevelNum < currentLevelNum) {
    // Registering for lower level - not allowed without admin approval
    return {
      allowed: false,
      reason: `You cannot register for ${requestedLevel} level. Your current level is ${currentLevel}. To register for a lower level, please contact administration for approval.`,
      allowedLevels: [currentLevel, getNextLevel(currentLevel)],
    };
  }

  if (requestedLevelNum > currentLevelNum + 100) {
    // Trying to skip levels - not allowed
    return {
      allowed: false,
      reason: `You cannot skip levels. Your current level is ${currentLevel}. You can only register for ${currentLevel} or ${getNextLevel(currentLevel)} level.`,
      allowedLevels: [currentLevel, getNextLevel(currentLevel)],
    };
  }

  return { allowed: true };
}

/**
 * Get next level after current level
 */
function getNextLevel(currentLevel: string): string {
  const levelNum = extractLevelNumber(currentLevel);
  if (!levelNum || levelNum >= 500) {
    return currentLevel; // Already at max level
  }
  return `${levelNum + 100}`;
}

/**
 * Validate if student can register for a specific semester
 * Rules:
 * 1. If student has no registration history, they can register for First Semester
 * 2. If student registered for First Semester in a session, they can register for Second Semester in same session
 * 3. If student completed both semesters, they can register for First Semester of next level
 */
export async function validateSemesterRegistration(
  studentId: string,
  requestedLevel: string,
  requestedSemester: string,
  sessionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Get student's registration history for this session
  const history = await retryDbOperation(() =>
    prisma.studentLevelHistory.findMany({
      where: {
        studentId,
        sessionId,
      },
      include: {
        session: true,
      },
    })
  );

  // Check if student has any course registrations for this session/level
  // Note: StudentCourse doesn't have a direct course relation, so we need to get course info separately
  const studentCourses = await retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      select: {
        courseId: true,
        courseCode: true,
      },
    })
  );

  if (studentCourses.length === 0) {
    // No courses registered yet, allow First Semester
    if (requestedSemester.toLowerCase().includes('first')) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'You must register for First Semester before registering for Second Semester.',
    };
  }

  // Get course details for the registered courses to check their level and semester
  const courseIds = studentCourses.map(sc => sc.courseId);
  const courses = await retryDbOperation(() =>
    prisma.course.findMany({
      where: {
        id: { in: courseIds },
        sessionId: sessionId,
      },
      select: {
        level: true,
        semester: true,
        sessionId: true,
      },
    })
  );

  // Filter courses for this session and level
  const requestedLevelNum = extractLevelNumber(requestedLevel);
  const sessionLevelCourses = courses.filter(course => {
    const courseLevelNum = extractLevelNumber(course.level);
    return (
      course.sessionId === sessionId &&
      courseLevelNum === requestedLevelNum
    );
  });

  // Check which semesters student has already registered for
  const registeredSemesters = new Set<string>();
  sessionLevelCourses.forEach(course => {
    if (course?.semester) {
      const sem = course.semester.toLowerCase();
      if (sem.includes('first')) {
        registeredSemesters.add('First');
      } else if (sem.includes('second')) {
        registeredSemesters.add('Second');
      }
    }
  });

  const requestedSemLower = requestedSemester.toLowerCase();
  const isFirst = requestedSemLower.includes('first');
  const isSecond = requestedSemLower.includes('second');

  // If no previous registration, allow First Semester
  if (registeredSemesters.size === 0 && isFirst) {
    return { allowed: true };
  }

  // If registered for First Semester, allow Second Semester
  if (registeredSemesters.has('First') && isSecond) {
    return { allowed: true };
  }

  // If trying to register for First Semester again, check if they completed Second
  if (isFirst && registeredSemesters.has('First')) {
    if (registeredSemesters.has('Second')) {
      // Completed both semesters - should progress to next level
      return {
        allowed: false,
        reason: 'You have already completed both semesters for this level. Please register for the next level or contact administration.',
      };
    }
    return {
      allowed: false,
      reason: 'You have already registered for First Semester. Please register for Second Semester to complete this level.',
    };
  }

  // If trying to register for Second Semester without First
  if (isSecond && !registeredSemesters.has('First')) {
    return {
      allowed: false,
      reason: 'You must register for First Semester before registering for Second Semester.',
    };
  }

  return { allowed: true };
}

/**
 * Get allowed levels for a student based on their progression
 */
export async function getAllowedLevels(studentId: string): Promise<string[]> {
  const currentLevel = await getStudentCurrentLevel(studentId);
  
  if (!currentLevel) {
    // New student - only 100 level
    return ['100'];
  }

  const currentLevelNum = extractLevelNumber(currentLevel);
  if (!currentLevelNum) {
    return [currentLevel];
  }

  // Can register for current level or next level
  const allowed: string[] = [currentLevel];
  
  if (currentLevelNum < 500) {
    allowed.push(getNextLevel(currentLevel));
  }

  return allowed;
}

/**
 * Comprehensive validation for course registration
 */
export async function validateCourseRegistration(
  studentId: string,
  sessionId: string,
  level: string,
  semester: string
): Promise<{ allowed: boolean; reason?: string; allowedLevels?: string[] }> {
  // Validate level
  const levelValidation = await validateLevelRegistration(studentId, level, sessionId);
  if (!levelValidation.allowed) {
    return levelValidation;
  }

  // Validate semester
  const semesterValidation = await validateSemesterRegistration(studentId, level, semester, sessionId);
  if (!semesterValidation.allowed) {
    return semesterValidation;
  }

  return { allowed: true };
}

