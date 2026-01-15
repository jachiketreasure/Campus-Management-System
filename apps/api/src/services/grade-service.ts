import { prisma } from '@cms/database';
import { randomUUID } from 'crypto';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export type GradeComponent = {
  attendanceScore?: number | null;
  testScore?: number | null;
  assignmentScore?: number | null;
  examScore?: number | null;
};

export type CourseGradeDTO = {
  id: string;
  enrollmentId: string;
  courseId: string;
  studentId: string;
  sessionId: string;
  semester: string;
  attendanceScore?: number | null;
  testScore?: number | null;
  assignmentScore?: number | null;
  examScore?: number | null;
  totalScore?: number | null;
  attendanceCount: number;
  totalClassesHeld: number;
  lecturerAbsenceCount: number;
  letterGrade?: string | null;
  gradePoint?: number | null;
  isPassed: boolean;
  gradedBy?: string | null;
  gradedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    code: string;
    title: string;
    units?: number | null;
  };
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    registrationNumber?: string | null;
  };
};

type CourseGradeRecord = {
  id: string;
  enrollmentId: string;
  courseId: string;
  studentId: string;
  sessionId: string;
  semester: string;
  attendanceScore: number | null;
  testScore: number | null;
  assignmentScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  attendanceCount: number;
  totalClassesHeld: number;
  lecturerAbsenceCount: number;
  letterGrade: string | null;
  gradePoint: number | null;
  isPassed: boolean;
  gradedBy: string | null;
  gradedAt: Date | string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  course?: {
    id: string;
    code: string;
    title: string;
    units: number | null;
  };
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    registrationNumber: string | null;
  };
};

const toDTO = (grade: CourseGradeRecord): CourseGradeDTO => ({
  id: grade.id,
  enrollmentId: grade.enrollmentId,
  courseId: grade.courseId,
  studentId: grade.studentId,
  sessionId: grade.sessionId,
  semester: grade.semester,
  attendanceScore: grade.attendanceScore,
  testScore: grade.testScore,
  assignmentScore: grade.assignmentScore,
  examScore: grade.examScore,
  totalScore: grade.totalScore,
  attendanceCount: grade.attendanceCount,
  totalClassesHeld: grade.totalClassesHeld,
  lecturerAbsenceCount: grade.lecturerAbsenceCount,
  letterGrade: grade.letterGrade,
  gradePoint: grade.gradePoint,
  isPassed: grade.isPassed,
  gradedBy: grade.gradedBy,
  gradedAt: grade.gradedAt instanceof Date ? grade.gradedAt.toISOString() : grade.gradedAt ?? undefined,
  notes: grade.notes,
  createdAt: grade.createdAt instanceof Date ? grade.createdAt.toISOString() : grade.createdAt,
  updatedAt: grade.updatedAt instanceof Date ? grade.updatedAt.toISOString() : grade.updatedAt,
  ...(grade.course && { course: grade.course }),
  ...(grade.student && { student: grade.student })
});

/**
 * Calculate attendance score based on attendance records
 * Formula: (StudentAttendance / TotalClassesHeld) * 10
 */
export async function calculateAttendanceScore(
  studentId: string,
  courseId: string,
  sessionId: string,
  semester: string
): Promise<{ score: number; attendanceCount: number; totalClassesHeld: number; lecturerAbsenceCount: number }> {
  if (!usePrismaStore) {
    return { score: 8.5, attendanceCount: 20, totalClassesHeld: 24, lecturerAbsenceCount: 0 };
  }

  // Get course schedule info
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lecturerAssignments: {
        where: {
          sessionId,
          semester
        }
      }
    }
  });

  if (!course) {
    throw new Error('Course not found');
  }

  // Get session info for semester weeks
  const session = await prisma.academicSession.findUnique({
    where: { id: sessionId }
  });

  const semesterWeeks = session?.semesterWeeks ?? 24;
  
  // Get classes per week from lecturer assignment if available
  // Check if course has lecturer assignment with schedule info
  const lecturerAssignment = course.lecturerAssignments?.find(
    (assignment) => assignment.sessionId === sessionId && assignment.semester === semester
  );
  const classesPerWeek = lecturerAssignment?.classesPerWeek ?? 1; // Default to 1 if not specified
  const expectedClasses = semesterWeeks * classesPerWeek;

  // Get all attendance sessions for this course in the session
  // Note: We don't filter by semester here because attendance sessions don't have semester
  // The semester is only used to determine which CourseGrade record to update
  const attendanceSessions = await prisma.attendanceSession.findMany({
    where: {
      courseId,
      scheduledAt: {
        gte: session?.startDate,
        lte: session?.endDate
      },
      status: {
        in: ['OPEN', 'CLOSED']
      }
    }
  });
  
  console.log(`[Grade Service] Found ${attendanceSessions.length} attendance sessions for course ${courseId} in session date range`);

  // Get lecturer absences for this course
  const lecturerAbsences = await prisma.lecturerAbsence.findMany({
    where: {
      courseId,
      sessionId,
      semester,
      confirmed: true
    }
  });

  const lecturerAbsenceCount = lecturerAbsences.length;
  
  // Total classes held = actual sessions - lecturer absences
  // But we should also consider expected classes based on schedule
  // Use the maximum of: (expected classes - lecturer absences) or (actual sessions - lecturer absences)
  const actualSessionsMinusAbsences = Math.max(0, attendanceSessions.length - lecturerAbsenceCount);
  const expectedClassesMinusAbsences = Math.max(0, expectedClasses - lecturerAbsenceCount);
  
  // Use actual sessions if they exist, otherwise use expected
  const totalClassesHeld = actualSessionsMinusAbsences > 0 
    ? actualSessionsMinusAbsences 
    : expectedClassesMinusAbsences;

  // Get the course code for the target course
  const targetCourse = await prisma.course.findUnique({
    where: { id: courseId },
    select: { code: true }
  });

  // Get student's attendance records - query directly and filter by course CODE instead of courseId
  // This matches how the student attendance page queries records
  const allStudentRecords = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      status: 'PRESENT'
    },
    include: {
      session: {
        select: {
          id: true,
          courseId: true,
          scheduledAt: true,
          course: {
            select: {
              code: true
            }
          }
        }
      }
    }
  });

  // Debug: Log all attendance records and their course codes
  console.log(`[Grade Service] DEBUG: Student has ${allStudentRecords.length} attendance records`);
  console.log(`[Grade Service] DEBUG: Target course code=${targetCourse?.code}, courseId=${courseId}`);
  
  const uniqueCourseCodes = new Set<string>();
  allStudentRecords.forEach((record, idx) => {
    const recordCourseCode = record.session?.course?.code;
    if (recordCourseCode) {
      uniqueCourseCodes.add(recordCourseCode);
    }
    console.log(`[Grade Service] DEBUG Record ${idx + 1}: sessionId=${record.sessionId}, courseCode=${recordCourseCode}, target courseCode=${targetCourse?.code}, match=${recordCourseCode === targetCourse?.code}`);
  });
  console.log(`[Grade Service] DEBUG: Student has attendance for ${uniqueCourseCodes.size} unique course codes: ${Array.from(uniqueCourseCodes).join(', ')}`);

  // Filter by course CODE (not courseId) and session date range
  // This handles cases where the same course might have different courseIds
  const studentAttendanceRecords = allStudentRecords.filter(record => {
    if (!record.session) {
      console.log(`[Grade Service] DEBUG: Record ${record.id} has no session`);
      return false;
    }
    
    // Match by course code instead of courseId
    const recordCourseCode = record.session.course?.code;
    if (!targetCourse?.code || recordCourseCode !== targetCourse.code) {
      return false;
    }
    
    if (!session) return true;
    
    const recordDate = new Date(record.session.scheduledAt);
    const inDateRange = recordDate >= session.startDate && recordDate <= session.endDate;
    if (!inDateRange) {
      console.log(`[Grade Service] DEBUG: Record ${record.id} is outside date range. scheduledAt=${record.session.scheduledAt}, session.startDate=${session.startDate}, session.endDate=${session.endDate}`);
    }
    return inDateRange;
  });

  const attendanceCount = studentAttendanceRecords.length;
  
  console.log(`[Grade Service] Found ${attendanceCount} attendance records for student ${studentId}, course ${courseId} in session ${sessionId}`);
  console.log(`[Grade Service] Total student records: ${allStudentRecords.length}, filtered by course: ${allStudentRecords.filter(r => r.session?.courseId === courseId).length}`);

  // Calculate score: (attendanceCount / totalClassesHeld) * 10
  // If no classes held, return 0
  const score = totalClassesHeld > 0 ? (attendanceCount / totalClassesHeld) * 10 : 0;
  const cappedScore = Math.min(10, Math.max(0, score)); // Cap between 0 and 10

  return {
    score: Math.round(cappedScore * 100) / 100, // Round to 2 decimal places
    attendanceCount,
    totalClassesHeld,
    lecturerAbsenceCount
  };
}

/**
 * Calculate assignment score from AssignmentGrade
 */
async function calculateAssignmentScore(
  studentId: string,
  courseId: string,
  sessionId: string
): Promise<number | null> {
  if (!usePrismaStore) {
    return 8.5;
  }

  // Get all assignments for this course in this session
  const assignments = await prisma.assignment.findMany({
    where: {
      courseId,
      sessionId
    },
    include: {
      submissions: {
        where: {
          studentId,
          status: 'GRADED'
        },
        include: {
          grade: true
        }
      }
    }
  });

  if (assignments.length === 0) {
    return null;
  }

  // Calculate average assignment score (out of 10)
  let totalScore = 0;
  let totalMaxScore = 0;
  let gradedCount = 0;

  for (const assignment of assignments) {
    for (const submission of assignment.submissions) {
      if (submission.grade) {
        // Convert to out of 10 scale
        const scoreOutOf10 = (submission.grade.score / submission.grade.maxScore) * 10;
        totalScore += scoreOutOf10;
        totalMaxScore += 10;
        gradedCount++;
      }
    }
  }

  if (gradedCount === 0) {
    return null;
  }

  // Average of all assignments, capped at 10
  const averageScore = (totalScore / gradedCount);
  return Math.min(10, Math.round(averageScore * 100) / 100);
}

/**
 * Calculate total score from all components
 * Returns null if ANY component is missing (as per requirements)
 * Total = Attendance (10) + Test (10) + Assignment (10) + Exam (70) = 100
 */
function calculateTotalScore(components: GradeComponent): number | null {
  const { attendanceScore, testScore, assignmentScore, examScore } = components;

  // If ANY component is missing, return null (treat missing as null, not zero)
  if (
    attendanceScore === null || attendanceScore === undefined ||
    testScore === null || testScore === undefined ||
    assignmentScore === null || assignmentScore === undefined ||
    examScore === null || examScore === undefined
  ) {
    return null;
  }

  // All components present - calculate total
  const total = attendanceScore + testScore + assignmentScore + examScore;
  return Math.min(100, Math.max(0, Math.round(total * 100) / 100));
}

/**
 * Calculate letter grade and grade point
 */
/**
 * Calculate letter grade and grade point based on percentage score
 * Grading Scale:
 * 70% – 100% → A → 5.0
 * 60% – 69% → B → 4.0
 * 50% – 59% → C → 3.0
 * 45% – 49% → D → 2.0
 * 0% – 44% → F → 0.0
 */
function calculateLetterGradeAndPoint(totalScore: number | null): { letterGrade: string; gradePoint: number; isPassed: boolean } {
  if (totalScore === null || totalScore === undefined) {
    return { letterGrade: null as any, gradePoint: null as any, isPassed: false };
  }

  let letterGrade: string;
  let gradePoint: number;
  let isPassed: boolean;

  if (totalScore >= 70) {
    // 70% – 100% → A → 5.0
    letterGrade = 'A';
    gradePoint = 5.0;
    isPassed = true;
  } else if (totalScore >= 60) {
    // 60% – 69% → B → 4.0
    letterGrade = 'B';
    gradePoint = 4.0;
    isPassed = true;
  } else if (totalScore >= 50) {
    // 50% – 59% → C → 3.0
    letterGrade = 'C';
    gradePoint = 3.0;
    isPassed = true;
  } else if (totalScore >= 45) {
    // 45% – 49% → D → 2.0
    letterGrade = 'D';
    gradePoint = 2.0;
    isPassed = true;
  } else {
    // 0% – 44% → F → 0.0
    letterGrade = 'F';
    gradePoint = 0.0;
    isPassed = false;
  }

  return { letterGrade, gradePoint, isPassed };
}

/**
 * Get or create course grade for a student
 */
export async function getOrCreateCourseGrade(
  enrollmentId: string,
  courseId: string,
  studentId: string,
  sessionId: string,
  semester: string
): Promise<CourseGradeDTO> {
  if (!usePrismaStore) {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      enrollmentId,
      courseId,
      studentId,
      sessionId,
      semester,
      attendanceCount: 20,
      totalClassesHeld: 24,
      lecturerAbsenceCount: 0,
      isPassed: false,
      createdAt: now,
      updatedAt: now
    };
  }

  // Check if grade exists
  let grade = await prisma.courseGrade.findUnique({
    where: { enrollmentId },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    }
  });

  // Calculate attendance if not set
  if (!grade || grade.attendanceScore === null) {
    const attendanceData = await calculateAttendanceScore(studentId, courseId, sessionId, semester);
    
    if (!grade) {
      // Create new grade
      grade = await prisma.courseGrade.create({
        data: {
          enrollmentId,
          courseId,
          studentId,
          sessionId,
          semester,
          attendanceScore: attendanceData.score,
          attendanceCount: attendanceData.attendanceCount,
          totalClassesHeld: attendanceData.totalClassesHeld,
          lecturerAbsenceCount: attendanceData.lecturerAbsenceCount
        },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              units: true
            }
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              registrationNumber: true
            }
          }
        }
      });
    } else {
      // Update existing grade with attendance
      grade = await prisma.courseGrade.update({
        where: { id: grade.id },
        data: {
          attendanceScore: attendanceData.score,
          attendanceCount: attendanceData.attendanceCount,
          totalClassesHeld: attendanceData.totalClassesHeld,
          lecturerAbsenceCount: attendanceData.lecturerAbsenceCount
        },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              units: true
            }
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              registrationNumber: true
            }
          }
        }
      });
    }
  }

  // Calculate assignment score if not set
  if (grade.assignmentScore === null) {
    const assignmentScore = await calculateAssignmentScore(studentId, courseId, sessionId);
    if (assignmentScore !== null) {
      grade = await prisma.courseGrade.update({
        where: { id: grade.id },
        data: { assignmentScore },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              units: true
            }
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              registrationNumber: true
            }
          }
        }
      });
    }
  }

  // Recalculate total score
  const totalScore = calculateTotalScore({
    attendanceScore: grade.attendanceScore,
    testScore: grade.testScore,
    assignmentScore: grade.assignmentScore,
    examScore: grade.examScore
  });

  const { letterGrade, gradePoint, isPassed } = calculateLetterGradeAndPoint(totalScore);

  // Update with calculated values
  grade = await prisma.courseGrade.update({
    where: { id: grade.id },
    data: {
      totalScore,
      letterGrade,
      gradePoint,
      isPassed
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    }
  });

  return toDTO(grade as CourseGradeRecord);
}

/**
 * Initialize grades for all student courses in a session (for both semesters)
 * This ensures grades exist even if they haven't been accessed yet
 * Uses StudentCourse records to find enrolled courses
 */
async function initializeGradesForSession(
  studentId: string,
  sessionId: string
): Promise<void> {
  if (!usePrismaStore) {
    console.log('[Grade Service] Prisma store not enabled, skipping initialization');
    return;
  }

  try {
    console.log(`[Grade Service] Initializing grades for student ${studentId} in session ${sessionId}`);
    
    // Get session info to determine semester dates
    const session = await prisma.academicSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.log(`[Grade Service] Session ${sessionId} not found`);
      return;
    }

    console.log(`[Grade Service] Session found: ${session.name} (${session.startDate.toISOString()} to ${session.endDate.toISOString()})`);

    // Get all unique courses that the student has activity for in this session
    const courseIds = new Set<string>();

    // 1. Get courses from StudentCourse records
    const studentCourses = await prisma.studentCourse.findMany({
      where: { studentId },
      select: { courseId: true }
    });
    console.log(`[Grade Service] Found ${studentCourses.length} StudentCourse records`);
    studentCourses.forEach(sc => {
      courseIds.add(sc.courseId);
      console.log(`[Grade Service] Added course from StudentCourse: ${sc.courseId}`);
    });

    // 2. Get courses from attendance records in this session
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId,
        session: {
          scheduledAt: {
            gte: session.startDate,
            lte: session.endDate
          }
        }
      },
      include: {
        session: {
          select: {
            courseId: true
          }
        }
      }
    });
    console.log(`[Grade Service] Found ${attendanceRecords.length} attendance records in session date range`);
    attendanceRecords.forEach(ar => {
      if (ar.session?.courseId) {
        courseIds.add(ar.session.courseId);
        console.log(`[Grade Service] Added course from attendance: ${ar.session.courseId}`);
      }
    });

    // 3. Get courses from assignment submissions in this session
    const assignmentSubmissions = await prisma.assignmentSubmission.findMany({
      where: {
        studentId,
        assignment: {
          sessionId: sessionId
        }
      },
      include: {
        assignment: {
          select: {
            courseId: true
          }
        }
      }
    });
    console.log(`[Grade Service] Found ${assignmentSubmissions.length} assignment submissions in session`);
    assignmentSubmissions.forEach(sub => {
      if (sub.assignment?.courseId) {
        courseIds.add(sub.assignment.courseId);
        console.log(`[Grade Service] Added course from assignment submission: ${sub.assignment.courseId}`);
      }
    });

    // 4. Get courses from assignments in this session (even if not submitted yet)
    const assignments = await prisma.assignment.findMany({
      where: {
        sessionId: sessionId
      },
      select: {
        courseId: true
      }
    });
    console.log(`[Grade Service] Found ${assignments.length} assignments in session`);
    assignments.forEach(assignment => {
      courseIds.add(assignment.courseId);
      console.log(`[Grade Service] Added course from assignment: ${assignment.courseId}`);
    });

    // 5. Also check courses that are explicitly linked to this session
    const sessionCourses = await prisma.course.findMany({
      where: {
        sessionId: sessionId
      },
      select: {
        id: true
      }
    });
    console.log(`[Grade Service] Found ${sessionCourses.length} courses explicitly linked to session`);
    sessionCourses.forEach(course => {
      courseIds.add(course.id);
      console.log(`[Grade Service] Added course from session link: ${course.id}`);
    });

    if (courseIds.size === 0) {
      console.log(`[Grade Service] No courses found with activity for student ${studentId} in session ${sessionId}`);
      return;
    }

    console.log(`[Grade Service] Total unique courses found: ${courseIds.size}`);
    console.log(`[Grade Service] Course IDs: ${Array.from(courseIds).join(', ')}`);

    // Get or create enrollments and grades for each course
    for (const courseId of courseIds) {
      try {
        // Find or create enrollment
        let enrollment = await prisma.enrollment.findUnique({
          where: {
            courseId_studentId: {
              courseId: courseId,
              studentId: studentId
            }
          }
        });

        if (!enrollment) {
          // Create enrollment if it doesn't exist
          enrollment = await prisma.enrollment.create({
            data: {
              courseId: courseId,
              studentId: studentId,
              status: 'ACTIVE'
            }
          });
          console.log(`[Grade Service] Created enrollment for course ${courseId}`);
        } else {
          console.log(`[Grade Service] Found existing enrollment for course ${courseId}`);
        }

        // Get course info to determine semester from course code
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          select: { code: true }
        });

        // Determine which semester(s) this course belongs to
        // Check LecturerCourseAssignment to see which semester the course is taught
        const lecturerAssignments = await prisma.lecturerCourseAssignment.findMany({
          where: {
            courseId: courseId,
            sessionId: sessionId
          },
          select: {
            semester: true
          }
        });

        // Get unique semesters from assignments
        const courseSemesters = new Set<string>();
        lecturerAssignments.forEach(assignment => {
          courseSemesters.add(assignment.semester);
        });

        // If no lecturer assignment found, determine semester from course code
        // Typically: odd numbers (101, 103) = First Semester, even numbers (102, 104) = Second Semester
        if (courseSemesters.size === 0 && course) {
          const courseCodeMatch = course.code.match(/(\d+)$/);
          if (courseCodeMatch) {
            const courseNumber = parseInt(courseCodeMatch[1], 10);
            // Odd numbers = First Semester, Even numbers = Second Semester
            if (courseNumber % 2 === 1) {
              courseSemesters.add('First');
            } else {
              courseSemesters.add('Second');
            }
            console.log(`[Grade Service] Determined semester from course code ${course.code}: ${courseNumber % 2 === 1 ? 'First' : 'Second'}`);
          }
        }

        // If still no semester found, check assignments to determine semester
        if (courseSemesters.size === 0) {
          const assignments = await prisma.assignment.findMany({
            where: {
              courseId: courseId,
              sessionId: sessionId
            },
            select: {
              dueDate: true
            }
          });

          // Determine semester based on date (first half = First, second half = Second)
          if (assignments.length > 0 && session) {
            const sessionMidpoint = new Date(
              session.startDate.getTime() + 
              (session.endDate.getTime() - session.startDate.getTime()) / 2
            );
            
            assignments.forEach(assignment => {
              if (assignment.dueDate < sessionMidpoint) {
                courseSemesters.add('First');
              } else {
                courseSemesters.add('Second');
              }
            });
          }

          // If still no semester found, default to First (most common)
          if (courseSemesters.size === 0) {
            courseSemesters.add('First');
            console.log(`[Grade Service] No semester info found for course ${courseId}, defaulting to First`);
          }
        }

        console.log(`[Grade Service] Course ${courseId} belongs to semesters: ${Array.from(courseSemesters).join(', ')}`);

        // Create grades only for the relevant semesters
        for (const semester of Array.from(courseSemesters)) {
          // Check if grade already exists for this enrollment and semester
          const existingGrade = await prisma.courseGrade.findFirst({
            where: {
              enrollmentId: enrollment.id,
              sessionId: sessionId,
              semester: semester
            }
          });

          if (!existingGrade) {
            // Calculate attendance for this semester
            const attendanceData = await calculateAttendanceScore(
              studentId,
              courseId,
              sessionId,
              semester
            );

            // Calculate assignment score for this course/session
            const assignmentScore = await calculateAssignmentScore(
              studentId,
              courseId,
              sessionId
            );

            // Create grade for this semester
            await prisma.courseGrade.create({
              data: {
                enrollmentId: enrollment.id,
                courseId: courseId,
                studentId: studentId,
                sessionId: sessionId,
                semester: semester,
                attendanceScore: attendanceData.score,
                attendanceCount: attendanceData.attendanceCount,
                totalClassesHeld: attendanceData.totalClassesHeld,
                lecturerAbsenceCount: attendanceData.lecturerAbsenceCount,
                assignmentScore: assignmentScore
              }
            });

            console.log(`[Grade Service] ✓ Created grade for student ${studentId}, course ${courseId}, semester ${semester}, attendance: ${attendanceData.score}, assignment: ${assignmentScore ?? 'N/A'}`);
          } else {
            // ALWAYS recalculate attendance and assignment scores for existing grades
            const attendanceData = await calculateAttendanceScore(
              studentId,
              courseId,
              sessionId,
              semester
            );
            
            const assignmentScore = await calculateAssignmentScore(
              studentId,
              courseId,
              sessionId
            );
            
            // Update the grade with recalculated scores and correct semester
            await prisma.courseGrade.update({
              where: { id: existingGrade.id },
              data: {
                semester: semester, // Ensure semester is correct
                attendanceScore: attendanceData.score,
                attendanceCount: attendanceData.attendanceCount,
                totalClassesHeld: attendanceData.totalClassesHeld,
                lecturerAbsenceCount: attendanceData.lecturerAbsenceCount,
                assignmentScore: assignmentScore // Always update, even if null
              }
            });
            
            console.log(`[Grade Service] ✓ Updated existing grade for course ${courseId}, semester ${semester}, attendance: ${attendanceData.score}, assignment: ${assignmentScore ?? 'N/A'}`);
          }
        }
      } catch (courseError: any) {
        console.error(`[Grade Service] Error processing course ${courseId}:`, courseError);
        // Continue with next course
      }
    }
    
    console.log(`[Grade Service] ✓ Finished initializing grades for student ${studentId} in session ${sessionId}`);
  } catch (error) {
    console.error('[Grade Service] Error initializing grades:', error);
    // Don't throw - just log, as this is a background operation
  }
}

/**
 * Recalculate all grades for a student in a session to ensure scores are up to date
 */
async function recalculateAllGradesForSession(
  studentId: string,
  sessionId: string
): Promise<void> {
  if (!usePrismaStore) return;

  try {
    // Get all existing grades for this student and session
    const existingGrades = await prisma.courseGrade.findMany({
      where: {
        studentId,
        sessionId
      },
      include: {
        course: {
          select: {
            code: true
          }
        }
      }
    });

    console.log(`[Grade Service] Recalculating ${existingGrades.length} existing grades`);

    for (const grade of existingGrades) {
      try {
        // Determine correct semester from course code if needed
        let correctSemester = grade.semester;
        if (grade.course?.code) {
          const courseCodeMatch = grade.course.code.match(/(\d+)$/);
          if (courseCodeMatch) {
            const courseNumber = parseInt(courseCodeMatch[1], 10);
            correctSemester = courseNumber % 2 === 1 ? 'First' : 'Second';
          }
        }

        // Recalculate attendance
        const attendanceData = await calculateAttendanceScore(
          studentId,
          grade.courseId,
          sessionId,
          correctSemester
        );

        // Recalculate assignment score
        const assignmentScore = await calculateAssignmentScore(
          studentId,
          grade.courseId,
          sessionId
        );

        // Update the grade
        await prisma.courseGrade.update({
          where: { id: grade.id },
          data: {
            semester: correctSemester,
            attendanceScore: attendanceData.score,
            attendanceCount: attendanceData.attendanceCount,
            totalClassesHeld: attendanceData.totalClassesHeld,
            lecturerAbsenceCount: attendanceData.lecturerAbsenceCount,
            assignmentScore: assignmentScore
          }
        });

        console.log(`[Grade Service] ✓ Recalculated grade for ${grade.course?.code || grade.courseId}, semester: ${correctSemester}, attendance: ${attendanceData.score}, assignment: ${assignmentScore ?? 'N/A'}`);
      } catch (error: any) {
        console.error(`[Grade Service] Error recalculating grade ${grade.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Grade Service] Error recalculating grades:', error);
  }
}

/**
 * Get all grades for a student in a session
 * Auto-initializes grades if they don't exist
 */
export async function getStudentGrades(
  studentId: string,
  sessionId?: string,
  semester?: string
): Promise<CourseGradeDTO[]> {
  if (!usePrismaStore) {
    console.log('[Grade Service] Prisma store not enabled, returning empty array');
    return [];
  }

  console.log(`[Grade Service] getStudentGrades called: studentId=${studentId}, sessionId=${sessionId}, semester=${semester}`);

  // If sessionId is provided, initialize grades for that session
  if (sessionId) {
    console.log(`[Grade Service] Initializing grades for session ${sessionId}`);
    await initializeGradesForSession(studentId, sessionId);
    
    // Also recalculate all existing grades to ensure scores are up to date
    await recalculateAllGradesForSession(studentId, sessionId);
  } else {
    console.log('[Grade Service] No sessionId provided, skipping initialization');
  }

  const where: any = {
    studentId
  };

  if (sessionId) {
    where.sessionId = sessionId;
  }

  if (semester) {
    where.semester = semester;
  }

  console.log(`[Grade Service] Querying grades with where clause:`, JSON.stringify(where));

  const grades = await prisma.courseGrade.findMany({
    where,
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    },
    orderBy: [
      { semester: 'asc' },
      { course: { code: 'asc' } }
    ]
  });

  console.log(`[Grade Service] Found ${grades.length} grade records`);
  grades.forEach(grade => {
    console.log(`[Grade Service] Grade: ${grade.course?.code || 'N/A'} - ${grade.course?.title || 'N/A'} (${grade.semester})`);
  });

  return grades.map((grade) => toDTO(grade as CourseGradeRecord));
}

/**
 * Get grades for a course (lecturer view)
 */
export async function getCourseGrades(
  courseId: string,
  sessionId: string,
  semester: string
): Promise<CourseGradeDTO[]> {
  if (!usePrismaStore) {
    return [];
  }

  const grades = await prisma.courseGrade.findMany({
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
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    },
    orderBy: {
      student: {
        lastName: 'asc'
      }
    }
  });

  return grades.map((grade) => toDTO(grade as CourseGradeRecord));
}

/**
 * Update grade components (lecturer can update test and exam scores)
 */
export async function updateCourseGrade(
  gradeId: string,
  lecturerId: string,
  updates: {
    testScore?: number;
    examScore?: number;
    notes?: string;
  }
): Promise<CourseGradeDTO | null> {
  if (!usePrismaStore) {
    return null;
  }

  const grade = await prisma.courseGrade.findUnique({
    where: { id: gradeId },
    include: {
      course: true
    }
  });

  if (!grade) {
    return null;
  }

  // Validate scores
  if (updates.testScore !== undefined) {
    if (updates.testScore < 0 || updates.testScore > 10) {
      const error = new Error('Test score must be between 0 and 10');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
  }

  if (updates.examScore !== undefined) {
    if (updates.examScore < 0 || updates.examScore > 70) {
      const error = new Error('Exam score must be between 0 and 70');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
  }

  // Update grade
  const updated = await prisma.courseGrade.update({
    where: { id: gradeId },
    data: {
      ...(updates.testScore !== undefined && { testScore: updates.testScore }),
      ...(updates.examScore !== undefined && { examScore: updates.examScore }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      gradedBy: lecturerId,
      gradedAt: new Date()
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    }
  });

  // Recalculate total and letter grade
  const totalScore = calculateTotalScore({
    attendanceScore: updated.attendanceScore,
    testScore: updated.testScore,
    assignmentScore: updated.assignmentScore,
    examScore: updated.examScore
  });

  const { letterGrade, gradePoint, isPassed } = calculateLetterGradeAndPoint(totalScore);

  const final = await prisma.courseGrade.update({
    where: { id: gradeId },
    data: {
      totalScore,
      letterGrade,
      gradePoint,
      isPassed
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    }
  });

  return toDTO(final as CourseGradeRecord);
}

/**
 * Recalculate attendance for a grade (can be triggered manually)
 */
export async function recalculateAttendance(gradeId: string): Promise<CourseGradeDTO | null> {
  if (!usePrismaStore) {
    return null;
  }

  const grade = await prisma.courseGrade.findUnique({
    where: { id: gradeId }
  });

  if (!grade) {
    return null;
  }

  const attendanceData = await calculateAttendanceScore(
    grade.studentId,
    grade.courseId,
    grade.sessionId,
    grade.semester
  );

  const updated = await prisma.courseGrade.update({
    where: { id: gradeId },
    data: {
      attendanceScore: attendanceData.score,
      attendanceCount: attendanceData.attendanceCount,
      totalClassesHeld: attendanceData.totalClassesHeld,
      lecturerAbsenceCount: attendanceData.lecturerAbsenceCount
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    }
  });

  // Recalculate total
  const totalScore = calculateTotalScore({
    attendanceScore: updated.attendanceScore,
    testScore: updated.testScore,
    assignmentScore: updated.assignmentScore,
    examScore: updated.examScore
  });

  const { letterGrade, gradePoint, isPassed } = calculateLetterGradeAndPoint(totalScore);

  const final = await prisma.courseGrade.update({
    where: { id: gradeId },
    data: {
      totalScore,
      letterGrade,
      gradePoint,
      isPassed
    },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          units: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          registrationNumber: true
        }
      }
    }
  });

  return toDTO(final as CourseGradeRecord);
}

