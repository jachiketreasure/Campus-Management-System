import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';

/**
 * Get the next level for a given level
 * 100L -> 200L, 200L -> 300L, etc.
 */
export function getNextLevel(currentLevel: string): string | null {
  const levelMatch = currentLevel.match(/^(\d+)L$/i);
  if (!levelMatch) {
    return null;
  }
  
  const levelNumber = parseInt(levelMatch[1], 10);
  if (isNaN(levelNumber) || levelNumber < 100 || levelNumber >= 600) {
    return null; // Invalid level or already at max
  }
  
  const nextLevelNumber = levelNumber + 100;
  return `${nextLevelNumber}L`;
}

/**
 * Get the next chronological academic session after a given session
 * This finds the session with the earliest startDate that is after the given session's endDate
 */
export async function getNextChronologicalSession(
  currentSessionId: string
): Promise<{ id: string; name: string; startDate: Date } | null> {
  const currentSession = await retryDbOperation(() =>
    prisma.academicSession.findUnique({
      where: { id: currentSessionId },
      select: { endDate: true },
    })
  );

  if (!currentSession) {
    return null;
  }

  // Find the next session that starts after the current session ends
  const nextSession = await retryDbOperation(() =>
    prisma.academicSession.findFirst({
      where: {
        startDate: {
          gt: currentSession.endDate,
        },
      },
      orderBy: {
        startDate: 'asc', // Get the earliest next session
      },
      select: {
        id: true,
        name: true,
        startDate: true,
      },
    })
  );

  return nextSession as { id: string; name: string; startDate: Date } | null;
}

/**
 * Assign a student to a level and session combination
 * This creates a permanent record in StudentLevelHistory
 */
export async function assignStudentToLevelSession(
  studentId: string,
  level: string,
  sessionId: string,
  cohortSessionId?: string
): Promise<void> {
  // Check if assignment already exists
  const existing = await retryDbOperation(() =>
    prisma.studentLevelHistory.findUnique({
      where: {
        studentId_sessionId_level: {
          studentId,
          sessionId,
          level,
        },
      },
    })
  );

  if (existing) {
    // Already assigned - don't duplicate
    return;
  }

  // Create the historical record
  await retryDbOperation(() =>
    prisma.studentLevelHistory.create({
      data: {
        studentId,
        level,
        sessionId,
        cohortSessionId: cohortSessionId || sessionId, // Use provided cohort or default to session
      },
    })
  );

  // Update the student's current level and session
  await retryDbOperation(() =>
    prisma.visitor.update({
      where: { id: studentId },
      data: {
        academicLevel: level,
        currentSessionId: sessionId,
        cohortSessionId: cohortSessionId || sessionId,
      },
    })
  );
}

/**
 * Progress a student to the next level in the next chronological session
 * This maintains historical accuracy by creating a new record while preserving old ones
 */
export async function progressStudentToNextLevel(
  studentId: string
): Promise<{ success: boolean; newLevel?: string; newSessionId?: string; message: string }> {
  const student = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        academicLevel: true,
        currentSessionId: true,
        cohortSessionId: true,
        visitorType: true,
      },
    })
  );

  if (!student) {
    return { success: false, message: 'Student not found' };
  }

  const s = student as any;
  if (s.visitorType !== 'STUDENT') {
    return { success: false, message: 'User is not a student' };
  }

  if (!s.academicLevel || !s.currentSessionId) {
    return { success: false, message: 'Student does not have a current level or session assigned' };
  }

  // Get next level
  const nextLevel = getNextLevel(s.academicLevel);
  if (!nextLevel) {
    return { success: false, message: `Cannot progress from level ${s.academicLevel}. Maximum level reached or invalid level format.` };
  }

  // Get next chronological session
  const nextSession = await getNextChronologicalSession(s.currentSessionId);
  if (!nextSession) {
    return { success: false, message: 'No next academic session found. Please create a new session first.' };
  }

  // Assign student to next level and session
  await assignStudentToLevelSession(
    studentId,
    nextLevel,
    nextSession.id,
    s.cohortSessionId || s.currentSessionId // Preserve cohort session
  );

  return {
    success: true,
    newLevel: nextLevel,
    newSessionId: nextSession.id,
    message: `Student progressed from ${s.academicLevel} to ${nextLevel} for session ${nextSession.name}`,
  };
}

/**
 * Progress all eligible students to the next level when a new session starts
 * This should be called when a new academic session is created or activated
 */
export async function progressAllEligibleStudents(
  newSessionId: string
): Promise<{ progressed: number; errors: string[] }> {
  const newSession = await retryDbOperation(() =>
    prisma.academicSession.findUnique({
      where: { id: newSessionId },
      select: { startDate: true, name: true },
    })
  );

  if (!newSession) {
    return { progressed: 0, errors: ['New session not found'] };
  }

  // Find all students who have a current session that ends before the new session starts
  const students = await retryDbOperation(() =>
    prisma.visitor.findMany({
      where: {
        visitorType: 'STUDENT',
        academicLevel: { not: null },
        currentSessionId: { not: null },
      },
      select: {
        id: true,
        academicLevel: true,
        currentSessionId: true,
        cohortSessionId: true,
      },
    })
  );

  const errors: string[] = [];
  let progressed = 0;

  for (const student of students as any[]) {
    const st = student as any;
    if (!st.academicLevel || !st.currentSessionId) {
      continue;
    }

    // Check if student's current session ends before the new session starts
    const currentSession = await retryDbOperation(() =>
      prisma.academicSession.findUnique({
        where: { id: st.currentSessionId },
        select: { endDate: true },
      })
    ) as any;

    if (!currentSession) {
      errors.push(`Student ${st.id}: Current session not found`);
      continue;
    }

    // Only progress if the new session starts after the current session ends
    if ((newSession as any).startDate > currentSession.endDate) {
      try {
        const result = await progressStudentToNextLevel(st.id);
        if (result.success) {
          progressed++;
        } else {
          errors.push(`Student ${st.id}: ${result.message}`);
        }
      } catch (error: any) {
        errors.push(`Student ${student.id}: ${error.message || 'Unknown error'}`);
      }
    }
  }

  return { progressed, errors };
}

/**
 * Get student's level history
 */
export async function getStudentLevelHistory(studentId: string) {
  return await retryDbOperation(() =>
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
      orderBy: { assignedAt: 'asc' },
    })
  );
}

/**
 * Get student's current level and session info
 */
export async function getStudentCurrentLevelInfo(studentId: string) {
  const student = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        academicLevel: true,
        courseOfStudy: true,
        currentSessionId: true,
        cohortSessionId: true,
        registrationNumber: true,
      },
    })
  );

  const st = student as any;
  if (!st || !st.currentSessionId) {
    return null;
  }

  const session = await retryDbOperation(() =>
    prisma.academicSession.findUnique({
      where: { id: student.currentSessionId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    })
  );

  const cohortSession = st.cohortSessionId
    ? await retryDbOperation(() =>
        prisma.academicSession.findUnique({
          where: { id: st.cohortSessionId },
          select: {
            id: true,
            name: true,
          },
        })
      )
    : null;

  return {
    student: {
      id: st.id,
      registrationNumber: st.registrationNumber,
      academicLevel: st.academicLevel,
      courseOfStudy: st.courseOfStudy,
    },
    currentSession: session,
    cohortSession: cohortSession,
  };
}
















