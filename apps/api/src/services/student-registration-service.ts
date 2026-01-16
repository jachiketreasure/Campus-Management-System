import { prisma } from '@cms/database';
import bcrypt from 'bcryptjs';
import { retryDbOperation } from '../utils/db-retry';
import { registerForSession } from './session-service';
import { assignStudentToLevelSession } from './student-progression-service';

export async function getStudentRegistration(studentId: string) {
  const visitor = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: {
        currentSessionId: true,
        registrationNumber: true,
        academicLevel: true,
        courseOfStudy: true,
      },
    })
  );

  if (!visitor) {
    return null;
  }

  // Get session name if currentSessionId exists
  let sessionName = '';
  const v = visitor as any;
  if (v.currentSessionId) {
    const session = await retryDbOperation(() =>
      prisma.academicSession.findUnique({
        where: { id: v.currentSessionId },
        select: { name: true },
      })
    ) as any;
    sessionName = session?.name || '';
  }

  // Check if student has registered courses (this indicates registration is complete)
  const studentCourses = await retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      take: 1,
    })
  ) as any[];
  const isRegistered = studentCourses.length > 0;

  return {
    sessionId: v.currentSessionId || '',
    sessionName: sessionName,
    registrationNumber: v.registrationNumber,
    academicLevel: v.academicLevel,
    courseOfStudy: visitor.courseOfStudy,
    isRegistered: isRegistered,
  };
}

export async function saveStudentRegistration(
  studentId: string,
  data: {
    sessionId: string;
    registrationNumber: string;
    academicLevel: string;
    courseIds: string[];
    semester?: string; // Add semester to registration data
  },
  visitorInfo?: {
    email?: string;
    name?: string;
  }
) {
  // Validate level and semester registration before proceeding
  const { validateCourseRegistration } = await import('./student-level-validation-service');
  
  // Get semester from course data or default to First
  const semester = data.semester || 'First';
  
  const validation = await validateCourseRegistration(
    studentId,
    data.sessionId,
    data.academicLevel,
    semester
  );

  if (!validation.allowed) {
    throw new Error(validation.reason || 'Registration not allowed for this level and semester combination.');
  }

  // Check if visitor exists
  let visitor = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
    })
  );

  if (!visitor) {
    // Visitor doesn't exist - we need email and name to create it
    if (!visitorInfo?.email || !visitorInfo?.name) {
      throw new Error('Visitor record not found and required information is missing. Please log out and log back in.');
    }

    // Create the visitor record
    const defaultPassword = bcrypt.hashSync('ChangeMe123!', 10);
    
    visitor = await retryDbOperation(() =>
      prisma.visitor.create({
        data: {
          id: studentId,
          email: visitorInfo.email,
          name: visitorInfo.name,
          passwordHash: defaultPassword,
          visitorType: 'STUDENT' as any,
          status: 'ACTIVE',
          currentSessionId: data.sessionId,
          registrationNumber: data.registrationNumber,
          academicLevel: data.academicLevel,
        },
      })
    );
  } else {
    // Update the existing visitor with registration info
    // Note: We'll use assignStudentToLevelSession to properly track history
    visitor = await retryDbOperation(() =>
      prisma.visitor.update({
        where: { id: studentId },
        data: {
          registrationNumber: data.registrationNumber,
          // Don't update level/session here - use assignStudentToLevelSession instead
        },
      })
    );
  }

  // Assign student to level and session (creates historical record)
  // This ensures the level+session combination is permanently tracked
  const existingCohortSessionId = visitor.cohortSessionId;
  await assignStudentToLevelSession(
    studentId,
    data.academicLevel,
    data.sessionId,
    existingCohortSessionId || data.sessionId // Preserve existing cohort or use current session
  );

  // Check if student has registered for the session, if not, register them
  const existingSessionRegistration = await retryDbOperation(() =>
    prisma.studentSessionRegistration.findUnique({
      where: {
        studentId_sessionId: {
          studentId,
          sessionId: data.sessionId,
        },
      },
    })
  );

  if (!existingSessionRegistration) {
    // Auto-register student for the session when they register for courses
    try {
      await registerForSession(studentId, data.sessionId);
    } catch (error: any) {
      // Log error but don't fail the course registration
      console.error('Error auto-registering for session:', error);
    }
  }

  // Get course details for the selected courses
  const courses = await retryDbOperation(() =>
    prisma.course.findMany({
      where: {
        id: { in: data.courseIds },
      },
      select: {
        id: true,
        code: true,
        title: true,
        units: true,
      },
    })
  );

  // Delete existing student courses
  await retryDbOperation(() =>
    prisma.studentCourse.deleteMany({
      where: { studentId },
    })
  );

  // Create new student course enrollments
  await retryDbOperation(() =>
    prisma.studentCourse.createMany({
      data: (courses as any[]).map((course: any) => ({
        studentId,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        units: course.units || null,
      })),
    })
  );

  // Get session name for response
  const session = await retryDbOperation(() =>
    prisma.academicSession.findUnique({
      where: { id: data.sessionId },
      select: { name: true },
    })
  );

  // Check if registration is complete (has courses)
  const hasCourses = courses.length > 0;

  // Get updated visitor info after assignment
  const updatedVisitor = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: {
        academicLevel: true,
        courseOfStudy: true,
      },
    })
  );

  return {
    sessionId: data.sessionId,
    sessionName: session?.name || '',
    registrationNumber: (visitor as any).registrationNumber,
    academicLevel: (updatedVisitor as any)?.academicLevel || data.academicLevel,
    courseOfStudy: (updatedVisitor as any)?.courseOfStudy,
    isRegistered: hasCourses,
  };
}

export async function getStudentCourses(studentId: string) {
  // Get student's current session
  const visitor = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: { currentSessionId: true, academicLevel: true },
    })
  );

  const sessionId = visitor?.currentSessionId;

  // Get student courses
  const studentCourses = await retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    })
  );

  // Get course details and lecturer assignments
  const coursesWithLecturer = await Promise.all(
    studentCourses.map(async (sc) => {
      // Get course details
      const course = await retryDbOperation(() =>
        prisma.course.findUnique({
          where: { id: sc.courseId },
          select: {
            semester: true,
          },
        })
      );

      // Get lecturer assignment if session and semester are available
      let lecturer = null;
      const c = course as any;
      if (sessionId && c?.semester) {
        const assignment = await retryDbOperation(() =>
          prisma.lecturerCourseAssignment.findFirst({
            where: {
              courseId: (sc as any).courseId,
              sessionId: sessionId,
              semester: c.semester,
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
          })
        ) as any;

        if (assignment) {
          lecturer = {
            id: assignment.lecturer?.id,
            name: assignment.lecturer?.name,
            email: assignment.lecturer?.email,
          };
        }
      }

      return {
        ...sc,
        lecturer,
      };
    })
  );

  return coursesWithLecturer;
}

export async function getAvailableCourses(level?: string, semester?: string, sessionId?: string) {
  const where: any = {};
  
  // Build strict AND conditions - both level and semester must match exactly
  const conditions: any[] = [];
  
  if (level) {
    // Extract just the number from the level (e.g., "200" from "200" or "200 Level")
    const normalizedLevel = level.replace(/[^0-9]/g, ''); // Extract just the number: "200"
    
    // Only match exact level variations - be very strict to avoid matching "100" when searching for "200"
    // Match: "200", "200L", "200 Level", "200L Level" - but NOT "100", "100L", etc.
    const levelVariations = [
      normalizedLevel,          // "200" - exact number match
      `${normalizedLevel}L`,   // "200L"
      `${normalizedLevel} Level`, // "200 Level"
      `${normalizedLevel}L Level`, // "200L Level" (if stored this way)
    ];
    
    // Remove duplicates
    const uniqueLevels = [...new Set(levelVariations)];
    
    // Use OR to match any of the level formats, but must match EXACTLY
    // This ensures "200" doesn't match "100" or "300"
    conditions.push({
      AND: [
        {
          OR: uniqueLevels.map(lvl => ({ level: lvl }))
        },
        {
          level: { not: null }
        },
        {
          level: { not: '' }
        }
      ]
    });
  } else {
    // If no level specified, still exclude null/empty levels
    conditions.push({
      level: { not: null }
    });
    conditions.push({
      level: { not: '' }
    });
  }
  
  if (semester) {
    // Normalize semester - handle different case and format variations
    const semesterLower = semester.toLowerCase();
    const isFirst = semesterLower.includes('first');
    const isSecond = semesterLower.includes('second');
    
    const semesterVariations: string[] = [semester]; // Original
    
    if (isFirst) {
      semesterVariations.push('First', 'FIRST', 'first', 'First Semester');
    } else if (isSecond) {
      semesterVariations.push('Second', 'SECOND', 'second', 'Second Semester');
    }
    
    // Remove duplicates
    const uniqueSemesters = [...new Set(semesterVariations)];
    
    // Use OR to match any of the semester formats, but must match exactly
    conditions.push({
      OR: uniqueSemesters.map(sem => ({ semester: sem }))
    });
  }
  
  if (sessionId) {
    // Session can be the specific sessionId OR null (available across all sessions)
    conditions.push({
      OR: [
        { sessionId: sessionId },
        { sessionId: null }
      ]
    });
  }
  
  // Combine all conditions with AND - all must be true
  if (conditions.length > 0) {
    where.AND = conditions;
  }

  // Log the query for debugging
  console.log('🔍 Querying courses with filters:', { level, semester, sessionId, where });

  const courses = await retryDbOperation(() =>
    prisma.course.findMany({
      where,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        units: true,
        level: true,
        semester: true,
        sessionId: true,
      },
    })
  );

  console.log(`✅ Found ${courses.length} courses matching filters`);
  console.log(`📋 Courses returned:`, courses.map(c => ({ code: c.code, level: c.level, semester: c.semester })));
  
  // Additional client-side filtering to ensure strict level matching
  // This is a safety net in case the database query doesn't work as expected
  let filteredCourses = courses;
  if (level) {
    const normalizedLevel = level.replace(/[^0-9]/g, '');
    filteredCourses = courses.filter(course => {
      if (!course.level) return false;
      const courseLevel = course.level.replace(/[^0-9]/g, '');
      // Only include courses where the level number matches exactly
      return courseLevel === normalizedLevel;
    });
    
    if (filteredCourses.length !== courses.length) {
      console.warn(`⚠️ Filtered out ${courses.length - filteredCourses.length} courses that didn't match level ${normalizedLevel} exactly`);
      console.log(`📋 Filtered courses:`, filteredCourses.map(c => ({ code: c.code, level: c.level, semester: c.semester })));
    }
  }

  return filteredCourses;
}

/**
 * Get required courses for a specific level and semester
 * This returns all courses that should be registered for a given level and semester
 */
export async function getRequiredCourses(level: string, semester: string) {
  const courses = await retryDbOperation(() =>
    prisma.course.findMany({
      where: {
        level: level,
        semester: semester,
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        units: true,
        level: true,
        semester: true,
        sessionId: true,
      },
    })
  );

  return courses;
}

/**
 * Get required courses for a student based on their registration number and current level
 */
export async function getRequiredCoursesForStudent(registrationNumber: string, level?: string) {
  // First, get the student's current level if not provided
  let studentLevel = level;
  
  if (!studentLevel) {
    const student = await retryDbOperation(() =>
      prisma.visitor.findFirst({
        where: {
          registrationNumber: registrationNumber,
          visitorType: 'STUDENT',
        },
        select: {
          academicLevel: true,
        },
      })
    );

    if (!student) {
      throw new Error(`Student with registration number ${registrationNumber} not found`);
    }

    studentLevel = (student as any).academicLevel || '100';
  }

  // Get required courses for both semesters of the student's level
  const firstSemester = await getRequiredCourses(studentLevel, 'First');
  const secondSemester = await getRequiredCourses(studentLevel, 'Second');

  return {
    level: studentLevel,
    firstSemester,
    secondSemester,
    totalUnits: {
      first: (firstSemester as any[]).reduce((sum: number, course: any) => sum + (course.units || 0), 0),
      second: (secondSemester as any[]).reduce((sum: number, course: any) => sum + (course.units || 0), 0),
    },
  };
}

/**
 * Check if student has completed initial registration
 */
export async function checkInitialRegistrationComplete(studentId: string): Promise<boolean> {
  try {
    // First check if user exists (for NextAuth users)
    const user = await retryDbOperation(() =>
      prisma.user.findUnique({
        where: { id: studentId },
        include: { profile: true },
      })
    );

    if ((user as any)?.profile?.isRegistrationComplete) {
      return true;
    }

    // If user exists but no profile, create one (they haven't registered yet)
    if (user && !(user as any).profile) {
      return false;
    }

    // Also check Visitor model for backward compatibility
    const visitor = await retryDbOperation(() =>
      prisma.visitor.findUnique({
        where: { id: studentId },
      })
    );

    // If visitor exists but no user profile, check if they have basic info
    if (visitor && !user) {
      // For visitors, we'll check if they have registration number and other key fields
      // This is a fallback check
      return false; // Visitors need to complete registration through User model
    }

    return false;
  } catch (error) {
    // If there's any error (e.g., database connection), assume registration is not complete
    // This allows the user to proceed to registration
    console.error('Error checking initial registration:', error);
    return false;
  }
}

/**
 * Save initial student registration data
 */
export async function saveInitialStudentRegistration(
  studentId: string,
  data: {
    sex: string;
    dateOfBirth: string;
    stateOfOrigin: string;
    lgaOfOrigin: string;
    homeTown: string;
    permanentAddress: string;
    mobileNumber: string;
    contactAddress: string;
    bloodGroup: string;
    genotype: string;
    religion: string;
    email: string;
    sponsorFullName: string;
    sponsorAddress: string;
    sponsorMobileNumber: string;
    sponsorEmail: string;
    sponsorRelationship: string;
    nextOfKinFullName: string;
    nextOfKinAddress: string;
    nextOfKinMobileNumber: string;
    nextOfKinEmail: string;
    nextOfKinRelationship: string;
    department: string;
    programmeType: string;
    programme: string;
    modeOfEntry: string;
    entryYear: string;
    yearOfGraduation: string;
    yearOfStudy: string;
    passportPhotoUrl: string;
  }
) {
  // Check if user exists
  const user = await retryDbOperation(() =>
    prisma.user.findUnique({
      where: { id: studentId },
      include: { profile: true },
    })
  );

  if (!user) {
    throw new Error('User not found');
  }

  // Parse date of birth
  const dateOfBirth = new Date(data.dateOfBirth);

  // Create or update profile with all registration data
  const profile = await retryDbOperation(() =>
    prisma.profile.upsert({
      where: { userId: studentId },
      create: {
        userId: studentId,
        // Personal Information
        sex: data.sex,
        dateOfBirth: dateOfBirth,
        stateOfOrigin: data.stateOfOrigin,
        lgaOfOrigin: data.lgaOfOrigin,
        homeTown: data.homeTown,
        permanentAddress: data.permanentAddress,
        mobileNumber: data.mobileNumber,
        contactAddress: data.contactAddress,
        bloodGroup: data.bloodGroup,
        genotype: data.genotype,
        religion: data.religion,
        // Sponsor Details
        sponsorFullName: data.sponsorFullName,
        sponsorAddress: data.sponsorAddress,
        sponsorMobileNumber: data.sponsorMobileNumber,
        sponsorEmail: data.sponsorEmail,
        sponsorRelationship: data.sponsorRelationship,
        // Next of Kin Details
        nextOfKinFullName: data.nextOfKinFullName,
        nextOfKinAddress: data.nextOfKinAddress,
        nextOfKinMobileNumber: data.nextOfKinMobileNumber,
        nextOfKinEmail: data.nextOfKinEmail,
        nextOfKinRelationship: data.nextOfKinRelationship,
        // Programme Details
        department: data.department,
        programmeType: data.programmeType,
        programme: data.programme,
        modeOfEntry: data.modeOfEntry,
        entryYear: data.entryYear,
        yearOfGraduation: data.yearOfGraduation,
        yearOfStudy: data.yearOfStudy,
        studentMode: 'New Student',
        // Passport Photo
        passportPhotoUrl: data.passportPhotoUrl,
        isRegistrationComplete: true,
      },
      update: {
        // Personal Information
        sex: data.sex,
        dateOfBirth: dateOfBirth,
        stateOfOrigin: data.stateOfOrigin,
        lgaOfOrigin: data.lgaOfOrigin,
        homeTown: data.homeTown,
        permanentAddress: data.permanentAddress,
        mobileNumber: data.mobileNumber,
        contactAddress: data.contactAddress,
        bloodGroup: data.bloodGroup,
        genotype: data.genotype,
        religion: data.religion,
        // Sponsor Details
        sponsorFullName: data.sponsorFullName,
        sponsorAddress: data.sponsorAddress,
        sponsorMobileNumber: data.sponsorMobileNumber,
        sponsorEmail: data.sponsorEmail,
        sponsorRelationship: data.sponsorRelationship,
        // Next of Kin Details
        nextOfKinFullName: data.nextOfKinFullName,
        nextOfKinAddress: data.nextOfKinAddress,
        nextOfKinMobileNumber: data.nextOfKinMobileNumber,
        nextOfKinEmail: data.nextOfKinEmail,
        nextOfKinRelationship: data.nextOfKinRelationship,
        // Programme Details
        department: data.department,
        programmeType: data.programmeType,
        programme: data.programme,
        modeOfEntry: data.modeOfEntry,
        entryYear: data.entryYear,
        yearOfGraduation: data.yearOfGraduation,
        yearOfStudy: data.yearOfStudy,
        studentMode: 'New Student',
        // Passport Photo
        passportPhotoUrl: data.passportPhotoUrl,
        isRegistrationComplete: true,
      },
    })
  );

  // Update user email if provided and different
  if (data.email && data.email !== (user as any).email) {
    await retryDbOperation(() =>
      prisma.user.update({
        where: { id: studentId },
        data: { email: data.email },
      })
    );
  }

  return {
    success: true,
    isRegistrationComplete: (profile as any).isRegistrationComplete,
  };
}

