import { prisma } from '@cms/database';
import bcrypt from 'bcryptjs';

export type ExamIntegrityStatus = 'PENDING_ADMIN_REVIEW' | 'APPROVED' | 'DECLINED' | 'NEEDS_REVIEW';
export type ExamAttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'SUBMITTED' | 'ABANDONED';

export type ExamIntegrityQuestion = {
  id: string;
  type: 'MCQ' | 'Theory';
  question: string;
  options?: string[];
  correctAnswer?: string | number;
  marks: number;
};

export type CreateExamIntegrityInput = {
  lecturerId: string;
  title: string;
  courseCode: string;
  questions: ExamIntegrityQuestion[];
  duration: number;
  allowedAttempts: number;
  startDate: Date;
  endDate: Date;
  accessCode: string;
};

export type UpdateExamIntegrityStatusInput = {
  status: ExamIntegrityStatus;
  reviewNotes?: string;
  rejectionReason?: string;
};

// Exam Integrity CRUD
export async function createExamIntegrity(input: CreateExamIntegrityInput) {
  // First, verify the lecturer exists
  const lecturer = await prisma.visitor.findUnique({
    where: { id: input.lecturerId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!lecturer) {
    throw new Error(`Lecturer with ID ${input.lecturerId} not found. Please ensure you are logged in as a valid lecturer.`);
  }

  // Verify lecturer is assigned to this course
  // Find course by code
  const course = await prisma.course.findUnique({
    where: { code: input.courseCode },
    select: {
      id: true,
      semester: true,
      sessionId: true,
    },
  });

  if (!course) {
    throw new Error(`Course with code ${input.courseCode} not found`);
  }

  if (!course.sessionId || !course.semester) {
    throw new Error(`Course ${input.courseCode} is missing session or semester information`);
  }

  // Check if lecturer is assigned to this course for this semester
  const assignment = await prisma.lecturerCourseAssignment.findFirst({
    where: {
      lecturerId: input.lecturerId,
      courseId: course.id,
      sessionId: course.sessionId,
      semester: course.semester,
      status: 'ACTIVE',
    },
  });

  if (!assignment) {
    throw new Error(
      `You are not assigned to teach ${input.courseCode} for the current semester. ` +
      `Please assign yourself to this course first from the Courses page.`
    );
  }

  const exam = await prisma.examIntegrity.create({
    data: {
      lecturerId: input.lecturerId,
      title: input.title,
      courseCode: input.courseCode,
      questions: input.questions as any,
      duration: input.duration,
      allowedAttempts: input.allowedAttempts,
      startDate: input.startDate,
      endDate: input.endDate,
      accessCode: input.accessCode,
      status: 'PENDING_ADMIN_REVIEW',
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

  // Create notification for all admin users
  const adminUsers = await prisma.user.findMany({
    where: {
      roleAssignments: {
        some: {
          role: {
            name: 'ADMIN'
          }
        }
      }
    },
    select: { id: true }
  });
  
  const adminVisitors = await prisma.visitor.findMany({
    where: {
      visitorType: 'ADMIN',
      status: 'ACTIVE',
    },
    select: { id: true }
  });
  
  const allAdminIds = [
    ...adminUsers.map(u => u.id),
    ...adminVisitors.map(v => v.id)
  ];
  
  // If no admins found, use 'admin' as fallback for backward compatibility
  const adminIdsToNotify = allAdminIds.length > 0 ? allAdminIds : ['admin'];
  
  // Create notifications for all admins
  await Promise.all(
    adminIdsToNotify.map(adminId =>
      prisma.examNotification.create({
        data: {
          userId: adminId,
          examId: exam.id,
          message: `New exam "${exam.title}" submitted by ${lecturer.name} for review`,
          seen: false,
        },
      })
    )
  );

  return exam;
}

export async function getExamIntegrity(examId: string) {
  return prisma.examIntegrity.findUnique({
    where: { id: examId },
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
}

export async function listExamIntegrityForLecturer(lecturerId: string) {
  return prisma.examIntegrity.findMany({
    where: { lecturerId },
    include: {
      lecturer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listExamIntegrityForReview() {
  return prisma.examIntegrity.findMany({
    where: {
      status: 'PENDING_ADMIN_REVIEW',
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
    orderBy: { createdAt: 'desc' },
  });
}

export async function listApprovedExamIntegrityForCourse(courseCode: string) {
  return prisma.examIntegrity.findMany({
    where: {
      courseCode,
      status: 'APPROVED',
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
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateExamIntegrityStatus(
  examId: string,
  adminId: string,
  input: UpdateExamIntegrityStatusInput
) {
  const exam = await prisma.examIntegrity.findUnique({
    where: { id: examId },
    include: { lecturer: true },
  });

  if (!exam) {
    throw new Error('Exam not found');
  }

  const updateData: any = {
    status: input.status,
    updatedAt: new Date(),
  };

  if (input.status === 'NEEDS_REVIEW' && input.reviewNotes) {
    updateData.reviewNotes = input.reviewNotes;
  }

  if (input.status === 'DECLINED' && input.rejectionReason) {
    updateData.rejectionReason = input.rejectionReason;
  }

  const updatedExam = await prisma.examIntegrity.update({
    where: { id: examId },
    data: updateData,
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

  // Create notification for lecturer
  let notificationMessage = '';
  switch (input.status) {
    case 'APPROVED':
      notificationMessage = `Your exam "${exam.title}" has been approved and is now available to students.`;
      break;
    case 'DECLINED':
      notificationMessage = `Your exam "${exam.title}" has been declined. Reason: ${input.rejectionReason || 'No reason provided'}`;
      break;
    case 'NEEDS_REVIEW':
      notificationMessage = `Your exam "${exam.title}" has been sent back for review. Notes: ${input.reviewNotes || 'Please review and resubmit'}`;
      break;
  }

  await prisma.examNotification.create({
    data: {
      userId: exam.lecturerId,
      examId: exam.id,
      message: notificationMessage,
      seen: false,
    },
  });

  // If exam is approved, notify all students enrolled in the course
  if (input.status === 'APPROVED') {
    try {
      // Find course by code
      const course = await prisma.course.findUnique({
        where: { code: exam.courseCode },
        select: { id: true },
      });

      if (course) {
        // Get all students enrolled in this course
        const enrollments = await prisma.enrollment.findMany({
          where: {
            courseId: course.id,
            status: 'ACTIVE',
          },
          select: {
            studentId: true,
          },
        });

        // Also get students from StudentCourse table
        const studentCourses = await prisma.studentCourse.findMany({
          where: {
            courseId: course.id,
          },
          select: {
            studentId: true,
          },
        });

        // Combine and deduplicate student IDs
        const allStudentIds = [
          ...new Set([
            ...enrollments.map((e: any) => e.studentId),
            ...studentCourses.map((sc: any) => sc.studentId),
          ]),
        ];

        // Create notifications for all enrolled students
        await Promise.all(
          allStudentIds.map(async (studentId: string) => {
            try {
              // Check if student is a User or Visitor
              const user = await prisma.user.findUnique({
                where: { id: studentId },
                select: { id: true },
              });

              if (user) {
                // Student is a User - use notification service
                const { createNotification } = await import('./notification-service');
                await createNotification(
                  studentId,
                  'New Exam Available',
                  `A new exam "${exam.title}" is now available for ${exam.courseCode}. Start Date: ${new Date(exam.startDate).toLocaleDateString()}`,
                  'EXAM',
                  {
                    type: 'EXAM_APPROVED',
                    examId: exam.id,
                    examTitle: exam.title,
                    courseCode: exam.courseCode,
                    startDate: exam.startDate,
                    endDate: exam.endDate,
                  }
                );
              } else {
                // Student is a Visitor - create notification directly in Prisma
                await prisma.notification.create({
                  data: {
                    userId: studentId,
                    title: 'New Exam Available',
                    body: `A new exam "${exam.title}" is now available for ${exam.courseCode}. Start Date: ${new Date(exam.startDate).toLocaleDateString()}`,
                    category: 'EXAM',
                    data: {
                      type: 'EXAM_APPROVED',
                      examId: exam.id,
                      examTitle: exam.title,
                      courseCode: exam.courseCode,
                      startDate: exam.startDate,
                      endDate: exam.endDate,
                    },
                  },
                });
              }
            } catch (notifError) {
              // Don't fail exam update if notification fails
              console.error(`[exam-integrity-service] Failed to notify student ${studentId}:`, notifError);
            }
          })
        );
      }
    } catch (error) {
      // Don't fail exam update if notification fails
      console.error('[exam-integrity-service] Error creating exam notifications for students:', error);
    }
  }

  return updatedExam;
}

// Exam Attempts
export async function createExamAttempt(examId: string, studentId: string) {
  // Check if exam exists and is approved
  const exam = await prisma.examIntegrity.findUnique({
    where: { id: examId },
  });

  if (!exam) {
    throw new Error('Exam not found');
  }

  if (exam.status !== 'APPROVED') {
    throw new Error('Exam is not approved');
  }

  // Verify student is registered for this course
  const { isStudentRegisteredForCourseCode } = await import('./student-access-control-service');
  const isRegistered = await isStudentRegisteredForCourseCode(studentId, exam.courseCode);
  
  if (!isRegistered) {
    throw new Error(`You are not registered for course ${exam.courseCode}. Please register for the course to access this exam.`);
  }

  // Check if student already has a SUBMITTED attempt - prevent multiple submissions
  const submittedAttempt = await prisma.examAttempt.findFirst({
    where: {
      examId,
      studentId,
      status: 'SUBMITTED',
    },
  });

  if (submittedAttempt) {
    throw new Error('You have already submitted this exam. Only one attempt is allowed.');
  }

  // Check if student has an IN_PROGRESS attempt - reuse it instead of creating a new one
  const inProgressAttempt = await prisma.examAttempt.findFirst({
    where: {
      examId,
      studentId,
      status: 'IN_PROGRESS',
    },
  });

  if (inProgressAttempt) {
    // Return the existing in-progress attempt instead of creating a new one
    return prisma.examAttempt.findUnique({
      where: { id: inProgressAttempt.id },
      include: {
        exam: true,
      },
    });
  }

  // Check attempt count (for other statuses like COMPLETED, ABANDONED)
  const existingAttempts = await prisma.examAttempt.count({
    where: {
      examId,
      studentId,
    },
  });

  if (existingAttempts >= exam.allowedAttempts) {
    throw new Error('Maximum attempts reached');
  }

  return prisma.examAttempt.create({
    data: {
      examId,
      studentId,
      status: 'IN_PROGRESS',
    },
    include: {
      exam: true,
    },
  });
}

export async function getExamAttempt(attemptId: string) {
  return prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: true,
    },
  });
}

export async function listExamAttemptsForStudent(studentId: string) {
  return prisma.examAttempt.findMany({
    where: { studentId },
    include: {
      exam: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listExamAttemptsForExam(examId: string) {
  return prisma.examAttempt.findMany({
    where: { examId },
    include: {
      exam: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          registrationNumber: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listExamAttemptsForLecturer(lecturerId: string) {
  // Get all exams created by this lecturer
  const exams = await prisma.examIntegrity.findMany({
    where: { lecturerId },
    select: { id: true },
  });

  const examIds = exams.map((exam) => exam.id);

  if (examIds.length === 0) {
    return [];
  }

  return prisma.examAttempt.findMany({
    where: {
      examId: { in: examIds },
    },
    include: {
      exam: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          registrationNumber: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Automatically grade MCQ questions by comparing student answers with correct answers
 * Returns the total score and detailed breakdown
 */
export async function gradeExamAttempt(
  examId: string,
  studentAnswers: Record<string, any>
): Promise<{ totalScore: number; maxScore: number; breakdown: Array<{ questionId: string; correct: boolean; score: number; maxScore: number }> }> {
  // Get the exam with questions
  const exam = await prisma.examIntegrity.findUnique({
    where: { id: examId },
    select: {
      questions: true,
    },
  });

  if (!exam) {
    throw new Error('Exam not found');
  }

  const questions = exam.questions as ExamIntegrityQuestion[];
  let totalScore = 0;
  let maxScore = 0;
  const breakdown: Array<{ questionId: string; correct: boolean; score: number; maxScore: number }> = [];

  for (const question of questions) {
    maxScore += question.marks;
    
    // Only auto-grade MCQ questions
    if (question.type === 'MCQ' && question.correctAnswer !== undefined) {
      const studentAnswer = studentAnswers[question.id];
      const isCorrect = studentAnswer !== undefined && 
                       String(studentAnswer).trim() === String(question.correctAnswer).trim();
      
      const score = isCorrect ? question.marks : 0;
      totalScore += score;
      
      breakdown.push({
        questionId: question.id,
        correct: isCorrect,
        score,
        maxScore: question.marks,
      });
    } else {
      // Theory questions are not auto-graded
      breakdown.push({
        questionId: question.id,
        correct: false,
        score: 0,
        maxScore: question.marks,
      });
    }
  }

  return { totalScore, maxScore, breakdown };
}

/**
 * Get exam questions without exposing correct answers to students/admins
 * Only lecturers who created the exam can see correct answers
 */
export async function getExamQuestionsForStudent(examId: string): Promise<ExamIntegrityQuestion[]> {
  const exam = await prisma.examIntegrity.findUnique({
    where: { id: examId },
    select: {
      questions: true,
    },
  });

  if (!exam) {
    throw new Error('Exam not found');
  }

  const questions = exam.questions as ExamIntegrityQuestion[];
  
  // Remove correctAnswer from questions for students
  return questions.map(({ correctAnswer, ...question }) => question);
}

/**
 * Get exam questions with correct answers (only for lecturer who created the exam)
 */
export async function getExamQuestionsForLecturer(examId: string, lecturerId: string): Promise<ExamIntegrityQuestion[]> {
  const exam = await prisma.examIntegrity.findUnique({
    where: { id: examId },
    select: {
      lecturerId: true,
      questions: true,
    },
  });

  if (!exam) {
    throw new Error('Exam not found');
  }

  if (exam.lecturerId !== lecturerId) {
    throw new Error('Unauthorized: Only the exam creator can view correct answers');
  }

  return exam.questions as ExamIntegrityQuestion[];
}

export async function updateExamAttempt(attemptId: string, data: {
  status?: ExamAttemptStatus;
  score?: number;
  answers?: any;
  endTime?: Date;
}) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: true,
    },
  });

  if (!attempt) {
    throw new Error('Attempt not found');
  }

  // If status is SUBMITTED and we have answers, automatically grade MCQ questions
  if (data.status === 'SUBMITTED' && data.answers && !data.score) {
    try {
      const gradingResult = await gradeExamAttempt(attempt.examId, data.answers);
      data.score = gradingResult.totalScore;
      
      console.log(`[Exam Grading] Auto-graded attempt ${attemptId}: ${gradingResult.totalScore}/${gradingResult.maxScore}`);
    } catch (error) {
      console.error('[Exam Grading] Error auto-grading attempt:', error);
      // Don't fail submission if grading fails, but log the error
    }
  }

  return prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
    include: {
      exam: true,
    },
  });
}

// Exam Notifications
export async function listExamNotificationsForUser(userId: string) {
  return prisma.examNotification.findMany({
    where: {
      OR: [
        { userId },
        { userId: 'admin' }, // Also get admin notifications if user is admin
      ],
    },
    include: {
      exam: {
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
    orderBy: { createdAt: 'desc' },
  });
}

export async function markNotificationAsSeen(notificationId: string) {
  return prisma.examNotification.update({
    where: { id: notificationId },
    data: { seen: true },
  });
}

// Visitor/User management (for admin-created users)
export async function createVisitor(data: {
  name: string;
  email: string;
  password: string;
  visitorType: string;
  phone?: string;
  registrationNumber?: string;
}) {
  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 10);

  // Validate and cast visitorType to enum
  const validVisitorTypes = ['ADMIN', 'STUDENT', 'LECTURER', 'PARENT', 'GUEST', 'STAFF', 'ALUMNI'];
  const visitorType = data.visitorType.toUpperCase();
  
  if (!validVisitorTypes.includes(visitorType)) {
    throw new Error(`Invalid visitor type: ${data.visitorType}. Valid types are: ${validVisitorTypes.join(', ')}`);
  }

  return prisma.visitor.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      visitorType: visitorType as any,
      phone: data.phone || null,
      registrationNumber: data.registrationNumber || null,
      status: 'ACTIVE',
    },
  });
}

export async function getVisitorByEmail(email: string) {
  try {
    // Fastest: Use exact match with normalized email (assumes email is stored lowercase)
    // If not, fallback to case-insensitive search
    const normalizedEmail = email.toLowerCase().trim();
    
    // Try exact match first (fastest)
    let visitor = await prisma.visitor.findFirst({
      where: {
        email: normalizedEmail
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        visitorType: true,
        status: true,
        phone: true,
        registrationNumber: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
    
    // If not found, try case-insensitive (slower but more reliable)
    if (!visitor) {
      visitor = await prisma.visitor.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          visitorType: true,
          status: true,
          phone: true,
          registrationNumber: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        }
      });
    }
    
    return visitor;
  } catch (error: any) {
    // Handle MongoDB connection errors
    if (error.code === 'P1001' || error.message?.includes('connection') || error.message?.includes('ECONNREFUSED')) {
      throw new Error(
        'Database connection failed. Please ensure MongoDB is running and accessible. ' +
        'Check your DATABASE_URL environment variable.'
      );
    }
    throw error;
  }
}

export async function verifyVisitorPassword(visitor: any, password: string): Promise<boolean> {
  if (!visitor || !visitor.passwordHash) {
    return false;
  }
  
  try {
    return await bcrypt.compare(password, visitor.passwordHash);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

export async function updateVisitorLastLogin(visitorId: string) {
  // Fire and forget - don't block login response
  prisma.visitor.update({
    where: { id: visitorId },
    data: { lastLoginAt: new Date() },
  }).catch(err => {
    // Silently fail - login should not be blocked by this
    console.error('Failed to update last login:', err);
  });
}

/**
 * Retry a database operation with exponential backoff
 * Only retries on connection-related errors
 */
async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 500
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a connection error that we should retry
      const errorMessage = error?.message || '';
      const isConnectionError = 
        errorMessage.includes('I/O error') ||
        errorMessage.includes('forcibly closed') ||
        errorMessage.includes('connection') ||
        error?.code === 'P1001' || // Prisma connection error
        (error?.code === 'unknown' && errorMessage.includes('connection'));
      
      // Don't retry if it's not a connection error or if it's the last attempt
      if (!isConnectionError) {
        // Not a connection error, throw immediately
        throw error;
      }
      
      if (attempt === maxRetries - 1) {
        // Last attempt failed, throw the error
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`[RETRY] Database connection error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, errorMessage);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export async function listVisitors() {
  try {
    // Use retry logic for connection resilience
    return await retryDbOperation(async () => {
      // Optimize: Only select needed fields, exclude password hash
      return await prisma.visitor.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          visitorType: true,
          status: true,
          phone: true,
          registrationNumber: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  } catch (error: any) {
    // If retry fails, log and rethrow with better context
    console.error('Failed to list visitors after retries:', error);
    throw new Error(`Database error: ${error.message || 'Failed to retrieve visitors'}`);
  }
}

export async function updateVisitor(visitorId: string, data: {
  name?: string;
  email?: string;
  password?: string;
  visitorType?: string;
  status?: string;
  phone?: string;
  registrationNumber?: string;
}) {
  const updateData: any = { ...data };

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
    delete updateData.password;
  }

  // Ensure visitorType and status are properly typed if provided
  if (data.visitorType) {
    updateData.visitorType = data.visitorType as any;
  }

  if (data.status) {
    updateData.status = data.status as any;
  }

  try {
    return await prisma.visitor.update({
    where: { id: visitorId },
    data: updateData,
  });
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new Error('Visitor not found');
    }
    throw error;
  }
}

export async function deleteVisitor(visitorId: string) {
  try {
    return await prisma.visitor.delete({
    where: { id: visitorId },
  });
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new Error('Visitor not found');
    }
    throw error;
  }
}


