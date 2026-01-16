import { prisma } from '@cms/database';
import { retryDbOperation } from '../utils/db-retry';
import { createNotification } from './notification-service';

/**
 * Automatically close assignments that have passed their due date
 * This should be called periodically or when fetching assignments
 */
export async function closeOverdueAssignments(): Promise<number> {
  if (!prisma.assignment) {
    return 0;
  }

  const now = new Date();
  
  const result = await retryDbOperation(() =>
    prisma.assignment.updateMany({
      where: {
        status: { in: ['DRAFT', 'PUBLISHED'] },
        dueDate: { lt: now },
      },
      data: {
        status: 'CLOSED',
      },
    })
  );

  return (result as any).count;
}

export interface CreateAssignmentInput {
  courseId: string;
  sessionId: string;
  title: string;
  description?: string;
  instructions?: string;
  dueDate: string;
  maxScore?: number;
  attachments?: string[];
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  instructions?: string;
  dueDate?: string;
  maxScore?: number;
  attachments?: string[];
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
}

export interface AssignmentDTO {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  lecturerId: string;
  lecturerName: string;
  sessionId: string;
  sessionName: string;
  title: string;
  description?: string;
  instructions?: string;
  dueDate: string;
  maxScore: number;
  attachments: string[];
  status: string;
  submissionCount?: number;
  gradedCount?: number;
  createdAt: string;
  updatedAt: string;
  studentSubmission?: {
    id: string;
    status: string;
    submittedAt: string;
    grade?: {
      score: number;
      maxScore: number;
      returnedAt?: string;
    };
  };
}

export interface AssignmentSubmissionDTO {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRegistrationNumber?: string;
  content?: string;
  attachments: string[];
  submittedAt: string;
  status: string;
  grade?: {
    id: string;
    score: number;
    maxScore: number;
    feedback?: string;
    gradedAt: string;
    returnedAt?: string;
  };
}

/**
 * Get all assignments for a lecturer
 */
export async function getLecturerAssignments(lecturerId: string): Promise<AssignmentDTO[]> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment) {
    throw new Error('Assignment model not found. Please run: cd packages/database && npm run generate');
  }

  try {
    const assignments = await retryDbOperation(() =>
      prisma.assignment.findMany({
        where: {
          lecturerId,
        },
        include: {
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
          lecturer: {
            select: {
              name: true,
            },
          },
          submissions: {
            select: {
              id: true,
              status: true,
              grade: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    );

    return (assignments as any[]).map((assignment: any) => ({
      id: assignment.id,
      courseId: assignment.courseId,
      courseCode: assignment.course?.code,
      courseTitle: assignment.course?.title,
      lecturerId: assignment.lecturerId,
      lecturerName: assignment.lecturer?.name || 'Unknown Lecturer',
      sessionId: assignment.sessionId,
      sessionName: assignment.session?.name || 'Unknown Session',
      title: assignment.title,
      description: assignment.description || undefined,
      instructions: assignment.instructions || undefined,
      dueDate: (assignment.dueDate as any)?.toISOString?.() || assignment.dueDate,
      maxScore: Number(assignment.maxScore),
      attachments: assignment.attachments || [],
      status: assignment.status,
      submissionCount: (assignment.submissions as any[])?.length || 0,
      gradedCount: (assignment.submissions as any[])?.filter((s: any) => s.grade !== null).length || 0,
      createdAt: (assignment.createdAt as any)?.toISOString?.() || assignment.createdAt,
      updatedAt: (assignment.updatedAt as any)?.toISOString?.() || assignment.updatedAt,
    }));
  } catch (error: any) {
    // Provide helpful error message for common issues
    if (error.message?.includes('model') || error.message?.includes('not found') || error.message?.includes('Unknown field')) {
      throw new Error('Database model error. Please run: npm run generate in the packages/database directory');
    }
    if (error.message?.includes('timeout') || error.message?.includes('connection') || error.message?.includes('ECONNREFUSED')) {
      throw new Error('Database connection error. Please check your database connection and try again.');
    }
    throw error;
  }
}

/**
 * Get assignments for a specific course
 */
export async function getCourseAssignments(courseId: string, sessionId: string): Promise<AssignmentDTO[]> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment) {
    throw new Error('Assignment model not found. Please run: cd packages/database && npm run generate');
  }

  const assignments = await retryDbOperation(() =>
    prisma.assignment.findMany({
      where: {
        courseId,
        sessionId,
      },
      include: {
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
        lecturer: {
          select: {
            name: true,
          },
        },
        submissions: {
          select: {
            id: true,
            status: true,
            grade: {
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    })
  );

  return (assignments as any[]).map((assignment: any) => ({
    id: assignment.id,
    courseId: assignment.courseId,
    courseCode: assignment.course?.code,
    courseTitle: assignment.course?.title,
    lecturerId: assignment.lecturerId,
    lecturerName: assignment.lecturer?.name,
    sessionId: assignment.sessionId,
    sessionName: assignment.session?.name,
    title: assignment.title,
    description: assignment.description || undefined,
    instructions: assignment.instructions || undefined,
    dueDate: (assignment.dueDate as any)?.toISOString?.() || assignment.dueDate,
    maxScore: Number(assignment.maxScore),
    attachments: assignment.attachments,
    status: assignment.status,
    submissionCount: (assignment.submissions as any[])?.length || 0,
    gradedCount: (assignment.submissions as any[])?.filter((s: any) => s.grade !== null).length || 0,
    createdAt: (assignment.createdAt as any)?.toISOString?.() || assignment.createdAt,
    updatedAt: (assignment.updatedAt as any)?.toISOString?.() || assignment.updatedAt,
  }));
}

/**
 * Get a single assignment by ID
 */
export async function getAssignmentById(assignmentId: string): Promise<AssignmentDTO | null> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment) {
    throw new Error('Assignment model not found. Please run: cd packages/database && npm run generate');
  }

  const assignment: any = await retryDbOperation(() =>
    prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
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
        lecturer: {
          select: {
            name: true,
          },
        },
        submissions: {
          select: {
            id: true,
            status: true,
            grade: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    })
  );

  if (!assignment) {
    return null;
  }

  return {
    id: assignment.id,
    courseId: assignment.courseId,
    courseCode: assignment.course.code,
    courseTitle: assignment.course.title,
    lecturerId: assignment.lecturerId,
    lecturerName: assignment.lecturer?.name,
    sessionId: assignment.sessionId,
    sessionName: assignment.session?.name,
    title: assignment.title,
    description: assignment.description || undefined,
    instructions: assignment.instructions || undefined,
    dueDate: (assignment.dueDate as any)?.toISOString?.() || assignment.dueDate,
    maxScore: Number(assignment.maxScore),
    attachments: assignment.attachments,
    status: assignment.status,
    submissionCount: (assignment.submissions as any[])?.length || 0,
    gradedCount: (assignment.submissions as any[])?.filter((s: any) => s.grade !== null).length || 0,
    createdAt: (assignment.createdAt as any)?.toISOString?.() || assignment.createdAt,
    updatedAt: (assignment.updatedAt as any)?.toISOString?.() || assignment.updatedAt,
  };
}

/**
 * Create a new assignment
 */
export async function createAssignment(lecturerId: string, input: CreateAssignmentInput): Promise<AssignmentDTO> {
  try {
    // Check if Assignment model exists in Prisma client
    if (!prisma.assignment) {
      throw new Error('Assignment model not found. Please run: cd packages/database && npm run generate');
    }

    console.log('[assignment-service] Creating assignment:', { lecturerId, courseId: input.courseId, sessionId: input.sessionId });

    // Get course to find its semester
    const course: any = await retryDbOperation(() =>
      prisma.course.findUnique({
        where: { id: input.courseId },
        select: { semester: true },
      })
    );

    if (!course) {
      throw new Error('Course not found');
    }

    // Verify lecturer is assigned to this course for the session and semester
    const courseAssignment = await retryDbOperation(() =>
      prisma.lecturerCourseAssignment.findFirst({
        where: {
          lecturerId,
          courseId: input.courseId,
          sessionId: input.sessionId,
          status: 'ACTIVE',
          // If course has a semester, check that the assignment matches
          ...(course.semester ? { semester: course.semester } : {}),
        },
      })
    );

    if (!courseAssignment) {
      throw new Error('You are not assigned to this course for the selected session. Please contact an administrator to be assigned to the course.');
    }

    console.log('[assignment-service] Course assignment verified, creating assignment...');

    // Verify lecturer exists as a Visitor (required by Assignment model)
    let lecturer = await retryDbOperation(() =>
      prisma.visitor.findUnique({
        where: { id: lecturerId },
        select: { id: true, name: true },
      })
    );

    if (!lecturer) {
      // If lecturer doesn't exist as Visitor, check if they're a User and create a Visitor record
      const user: any = await retryDbOperation(() =>
        prisma.user.findUnique({
          where: { id: lecturerId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      );

      if (user) {
        // Create a Visitor record for this User
        const visitorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Lecturer';
        // Generate a placeholder password hash (Visitor won't use this for login since they're a User)
        // Using a bcrypt hash of a random string - this is just a placeholder
        const placeholderHash = '$2b$10$PLACEHOLDERHASHFORUSERCREATEDVISITOR1234567890123456789012';
        try {
          const newVisitor: any = await retryDbOperation(() =>
            prisma.visitor.create({
              data: {
                id: lecturerId, // Use same ID
                name: visitorName,
                email: user.email,
                passwordHash: placeholderHash, // Placeholder - Visitor uses User authentication
                visitorType: 'LECTURER',
                status: 'ACTIVE',
              },
              select: { id: true, name: true },
            })
          );
          lecturer = newVisitor;
          console.log('[assignment-service] Created Visitor record for User:', newVisitor.id);
        } catch (createError: any) {
          // If Visitor already exists (race condition), fetch it
          if (createError.code === 'P2002') {
            lecturer = await retryDbOperation(() =>
              prisma.visitor.findUnique({
                where: { id: lecturerId },
                select: { id: true, name: true },
              })
            );
            console.log('[assignment-service] Visitor already exists, using existing record');
          } else {
            throw createError;
          }
        }
      } else {
        throw new Error(`Lecturer with ID ${lecturerId} not found. Please ensure you are properly registered as a lecturer.`);
      }
    }

    if (!lecturer) {
      throw new Error(`Unable to find or create Visitor record for lecturer ID ${lecturerId}`);
    }

    const assignment: any = await retryDbOperation(() =>
      prisma.assignment.create({
        data: {
          courseId: input.courseId,
          sessionId: input.sessionId,
          lecturerId,
          title: input.title,
          description: input.description || null,
          instructions: input.instructions || null,
          dueDate: new Date(input.dueDate),
          maxScore: input.maxScore || 100,
          attachments: input.attachments || [],
          status: 'DRAFT',
        },
        include: {
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
          lecturer: {
            select: {
              name: true,
            },
          },
          submissions: true,
        },
      })
    );

    console.log('[assignment-service] Assignment created successfully:', assignment.id);

    const a = assignment as any;
    
    // Handle lecturer name - Assignment.lecturer is a Visitor relation, so it should have 'name'
    const lecturerName = a.lecturer?.name || 'Unknown Lecturer';
    
    return {
      id: a.id,
      courseId: a.courseId,
      courseCode: a.course?.code,
      courseTitle: a.course?.title,
      lecturerId: a.lecturerId,
      lecturerName,
      sessionId: a.sessionId,
      sessionName: a.session?.name,
      title: a.title,
      description: a.description || undefined,
      instructions: a.instructions || undefined,
      dueDate: a.dueDate?.toISOString?.() || a.dueDate,
      maxScore: Number(a.maxScore),
      attachments: a.attachments,
      status: a.status,
      submissionCount: 0,
      gradedCount: 0,
      createdAt: a.createdAt?.toISOString?.() || a.createdAt,
      updatedAt: assignment.updatedAt.toISOString(),
    };
  } catch (error: any) {
    console.error('[assignment-service] Error in createAssignment:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta,
    });
    
    // Provide helpful error messages
    if (error.message?.includes('model') || error.message?.includes('not found') || error.message?.includes('Unknown field')) {
      throw new Error('Database model error. Please run: npm run generate in the packages/database directory');
    }
    if (error.message?.includes('timeout') || error.message?.includes('connection') || error.message?.includes('ECONNREFUSED')) {
      throw new Error('Database connection error. Please check your database connection and try again.');
    }
    if (error.code === 'P2002') {
      throw new Error('A duplicate assignment already exists.');
    }
    if (error.code === 'P2003') {
      throw new Error('Invalid reference: The course, session, or lecturer does not exist.');
    }
    
    // Re-throw with original message if it's already a helpful error
    throw error;
  }
}

/**
 * Update an assignment
 */
export async function updateAssignment(
  assignmentId: string,
  lecturerId: string,
  input: UpdateAssignmentInput
): Promise<AssignmentDTO> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment) {
    throw new Error('Assignment model not found. Please run: cd packages/database && npm run generate');
  }

  // Verify lecturer owns this assignment
  const existing: any = await retryDbOperation(() =>
    prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { 
        lecturerId: true,
        status: true,
        courseId: true,
      },
    })
  );

  if (!existing) {
    throw new Error('Assignment not found');
  }

  if (existing.lecturerId !== lecturerId) {
    throw new Error('Unauthorized: You can only update your own assignments');
  }

  const updateData: any = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.instructions !== undefined) updateData.instructions = input.instructions || null;
  if (input.dueDate !== undefined) updateData.dueDate = new Date(input.dueDate);
  if (input.maxScore !== undefined) updateData.maxScore = input.maxScore;
  if (input.attachments !== undefined) updateData.attachments = input.attachments;
  if (input.status !== undefined) updateData.status = input.status;

  // Check if status is changing to PUBLISHED (for notifications)
  const wasPublished = existing.status === 'PUBLISHED';
  const isBeingPublished = input.status === 'PUBLISHED' && !wasPublished;

  const assignment: any = await retryDbOperation(() =>
    prisma.assignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
        session: {
          select: {
            name: true,
          },
        },
        lecturer: {
          select: {
            name: true,
          },
        },
        submissions: {
          select: {
            id: true,
            status: true,
            grade: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    })
  );

  // If assignment is being published, notify all enrolled students
  if (isBeingPublished) {
    try {
      // Get all students enrolled in this course
      const enrollments = await retryDbOperation(() =>
        prisma.enrollment.findMany({
          where: {
            courseId: assignment.courseId,
            status: 'ACTIVE',
          },
          select: {
            studentId: true,
          },
        })
      );

      // Also get students from StudentCourse table
      const studentCourses = await retryDbOperation(() =>
        prisma.studentCourse.findMany({
          where: {
            courseId: assignment.courseId,
          },
          select: {
            studentId: true,
          },
        })
      );

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
              // Student is a User
              await createNotification(
                studentId,
                'New Assignment Published',
                `A new assignment "${assignment.title}" has been published for ${assignment.course.code}. Due: ${new Date(assignment.dueDate).toLocaleDateString()}`,
                'SYSTEM',
                {
                  type: 'ASSIGNMENT_PUBLISHED',
                  assignmentId: assignment.id,
                  assignmentTitle: assignment.title,
                  courseCode: assignment.course.code,
                  courseTitle: assignment.course.title,
                  dueDate: assignment.dueDate,
                }
              );
            } else {
              // Student is a Visitor - create notification directly in Prisma
              await prisma.notification.create({
                data: {
                  userId: studentId,
                  title: 'New Assignment Published',
                  body: `A new assignment "${assignment.title}" has been published for ${assignment.course.code}. Due: ${new Date(assignment.dueDate).toLocaleDateString()}`,
                  category: 'SYSTEM',
                  data: {
                    type: 'ASSIGNMENT_PUBLISHED',
                    assignmentId: assignment.id,
                    assignmentTitle: assignment.title,
                    courseCode: assignment.course.code,
                    courseTitle: assignment.course.title,
                    dueDate: assignment.dueDate,
                  },
                },
              });
            }
          } catch (notifError) {
            // Don't fail assignment update if notification fails
            console.error(`[assignment-service] Failed to notify student ${studentId}:`, notifError);
          }
        })
      );
    } catch (error) {
      // Don't fail assignment update if notification fails
      console.error('[assignment-service] Error creating assignment notifications:', error);
    }
  }

  return {
    id: assignment.id,
    courseId: assignment.courseId,
    courseCode: assignment.course.code,
    courseTitle: assignment.course.title,
    lecturerId: assignment.lecturerId,
    lecturerName: assignment.lecturer?.name,
    sessionId: assignment.sessionId,
    sessionName: assignment.session?.name,
    title: assignment.title,
    description: assignment.description || undefined,
    instructions: assignment.instructions || undefined,
    dueDate: (assignment.dueDate as any)?.toISOString?.() || assignment.dueDate,
    maxScore: Number(assignment.maxScore),
    attachments: assignment.attachments,
    status: assignment.status,
    submissionCount: (assignment.submissions as any[])?.length || 0,
    gradedCount: (assignment.submissions as any[])?.filter((s: any) => s.grade !== null).length || 0,
    createdAt: (assignment.createdAt as any)?.toISOString?.() || assignment.createdAt,
    updatedAt: (assignment.updatedAt as any)?.toISOString?.() || assignment.updatedAt,
  };
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(assignmentId: string, lecturerId: string): Promise<void> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment) {
    throw new Error('Assignment model not found. Please run: cd packages/database && npm run generate');
  }

  // Verify lecturer owns this assignment
  const existing = await retryDbOperation(() =>
    prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { lecturerId: true },
    })
  );

  if (!existing) {
    throw new Error('Assignment not found');
  }

  if (existing.lecturerId !== lecturerId) {
    throw new Error('Unauthorized: You can only delete your own assignments');
  }

  await retryDbOperation(() =>
    prisma.assignment.delete({
      where: { id: assignmentId },
    })
  );
}

/**
 * Get submissions for an assignment
 */
export async function getAssignmentSubmissions(assignmentId: string, lecturerId: string): Promise<AssignmentSubmissionDTO[]> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment || !prisma.assignmentSubmission) {
    throw new Error('Assignment models not found. Please run: cd packages/database && npm run generate');
  }

  // Verify lecturer owns this assignment
  const assignment = await retryDbOperation(() =>
    prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { lecturerId: true, title: true },
    })
  );

  if (!assignment) {
    throw new Error('Assignment not found');
  }

  if (assignment.lecturerId !== lecturerId) {
    throw new Error('Unauthorized: You can only view submissions for your own assignments');
  }

  const submissions = await retryDbOperation(() =>
    prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            registrationNumber: true,
          },
        },
        grade: {
          include: {
            lecturer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    })
  );

  return (submissions as any[]).map((submission: any) => ({
    id: submission.id,
    assignmentId: submission.assignmentId,
    assignmentTitle: assignment.title,
    studentId: submission.studentId,
    studentName: submission.student.name,
    studentEmail: submission.student.email,
    studentRegistrationNumber: submission.student.registrationNumber || undefined,
    content: submission.content || undefined,
    attachments: submission.attachments,
    submittedAt: submission.submittedAt.toISOString(),
    status: submission.status,
    grade: submission.grade
      ? {
          id: submission.grade.id,
          score: Number(submission.grade.score),
          maxScore: Number(submission.grade.maxScore),
          feedback: submission.grade.feedback || undefined,
          gradedAt: submission.grade.gradedAt.toISOString(),
          returnedAt: submission.grade.returnedAt?.toISOString(),
        }
      : undefined,
  }));
}

/**
 * Grade an assignment submission
 */
export async function gradeSubmission(
  submissionId: string,
  lecturerId: string,
  score: number,
  maxScore: number,
  feedback?: string
): Promise<AssignmentSubmissionDTO> {
  // Check if Assignment models exist in Prisma client
  if (!prisma.assignment || !prisma.assignmentSubmission || !prisma.assignmentGrade) {
    throw new Error('Assignment models not found. Please run: cd packages/database && npm run generate');
  }

  // Verify submission exists and lecturer has access
  const submission = await retryDbOperation(() =>
    prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            lecturerId: true,
            maxScore: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            registrationNumber: true,
          },
        },
      },
    })
  );

  if (!submission) {
    throw new Error('Submission not found');
  }

  if (submission.assignment.lecturerId !== lecturerId) {
    throw new Error('Unauthorized: You can only grade submissions for your own assignments');
  }

  // Use assignment's maxScore if not provided
  const finalMaxScore = maxScore || Number(submission.assignment.maxScore);

  // Create or update grade
  const grade = await retryDbOperation(() =>
    prisma.assignmentGrade.upsert({
      where: { submissionId },
      create: {
        submissionId,
        lecturerId,
        score,
        maxScore: finalMaxScore,
        feedback: feedback || null,
      },
      update: {
        score,
        maxScore: finalMaxScore,
        feedback: feedback || null,
        gradedAt: new Date(),
      },
    })
  );

  // Update submission status
  await retryDbOperation(() =>
    prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'GRADED',
      },
    })
  );

  // Get updated submission with grade
  const updatedSubmission = await retryDbOperation(() =>
    prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            registrationNumber: true,
          },
        },
        grade: {
          include: {
            lecturer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })
  );

  if (!updatedSubmission) {
    throw new Error('Failed to retrieve updated submission');
  }

  return {
    id: updatedSubmission.id,
    assignmentId: updatedSubmission.assignmentId,
    assignmentTitle: submission.assignment.title,
    studentId: updatedSubmission.studentId,
    studentName: updatedSubmission.student.name,
    studentEmail: updatedSubmission.student.email,
    studentRegistrationNumber: updatedSubmission.student.registrationNumber || undefined,
    content: updatedSubmission.content || undefined,
    attachments: updatedSubmission.attachments,
    submittedAt: updatedSubmission.submittedAt.toISOString(),
    status: updatedSubmission.status,
    grade: {
      id: updatedSubmission.grade!.id,
      score: Number(updatedSubmission.grade!.score),
      maxScore: Number(updatedSubmission.grade!.maxScore),
      feedback: updatedSubmission.grade!.feedback || undefined,
      gradedAt: updatedSubmission.grade!.gradedAt.toISOString(),
      returnedAt: updatedSubmission.grade!.returnedAt?.toISOString(),
    },
  };
}

/**
 * Return graded assignment to student
 */
export async function returnGradedAssignment(submissionId: string, lecturerId: string): Promise<AssignmentSubmissionDTO> {
  // Check if Assignment models exist in Prisma client
  if (!prisma.assignment || !prisma.assignmentSubmission || !prisma.assignmentGrade) {
    throw new Error('Assignment models not found. Please run: cd packages/database && npm run generate');
  }

  // Verify submission exists and has been graded
  const submission = await retryDbOperation(() =>
    prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            lecturerId: true,
          },
        },
        grade: {
          select: {
            id: true,
            lecturerId: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            registrationNumber: true,
          },
        },
      },
    })
  );

  if (!submission) {
    throw new Error('Submission not found');
  }

  if (submission.assignment.lecturerId !== lecturerId) {
    throw new Error('Unauthorized: You can only return submissions for your own assignments');
  }

  if (!submission.grade) {
    throw new Error('Submission must be graded before it can be returned');
  }

  if (submission.grade.lecturerId !== lecturerId) {
    throw new Error('Unauthorized: You can only return submissions you graded');
  }

  // Update grade with returnedAt timestamp
  await retryDbOperation(() =>
    prisma.assignmentGrade.update({
      where: { id: submission.grade.id },
      data: {
        returnedAt: new Date(),
      },
    })
  );

  // Update submission status
  await retryDbOperation(() =>
    prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'RETURNED',
      },
    })
  );

  // Get updated submission
  const updatedSubmission = await retryDbOperation(() =>
    prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            registrationNumber: true,
          },
        },
        grade: {
          include: {
            lecturer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })
  );

  if (!updatedSubmission) {
    throw new Error('Failed to retrieve updated submission');
  }

  // Notify student that their grade has been returned
  try {
    const studentId = updatedSubmission.studentId;
    const assignmentTitle = submission.assignment.title;
    const grade = updatedSubmission.grade!;
    const score = Number(grade.score);
    const maxScore = Number(grade.maxScore);

    // Check if student is a User or Visitor
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true },
    });

    if (user) {
      // Student is a User
      await createNotification(
        studentId,
        'Grade Returned',
        `Your grade for "${assignmentTitle}" has been returned. Score: ${score}/${maxScore}`,
        'SYSTEM',
        {
          type: 'GRADE_RETURNED',
          assignmentId: submission.assignment.id,
          assignmentTitle,
          submissionId,
          score,
          maxScore,
          feedback: grade.feedback || undefined,
        }
      );
    } else {
      // Student is a Visitor - create notification directly in Prisma
      await prisma.notification.create({
        data: {
          userId: studentId,
          title: 'Grade Returned',
          body: `Your grade for "${assignmentTitle}" has been returned. Score: ${score}/${maxScore}`,
          category: 'SYSTEM',
          data: {
            type: 'GRADE_RETURNED',
            assignmentId: submission.assignment.id,
            assignmentTitle,
            submissionId,
            score,
            maxScore,
            feedback: grade.feedback || undefined,
          },
        },
      });
    }
  } catch (notifError) {
    // Don't fail grade return if notification fails
    console.error('[assignment-service] Error creating grade notification:', notifError);
  }

  return {
    id: updatedSubmission.id,
    assignmentId: updatedSubmission.assignmentId,
    assignmentTitle: submission.assignment.title,
    studentId: updatedSubmission.studentId,
    studentName: updatedSubmission.student.name,
    studentEmail: updatedSubmission.student.email,
    studentRegistrationNumber: updatedSubmission.student.registrationNumber || undefined,
    content: updatedSubmission.content || undefined,
    attachments: updatedSubmission.attachments,
    submittedAt: updatedSubmission.submittedAt.toISOString(),
    status: updatedSubmission.status,
    grade: {
      id: updatedSubmission.grade!.id,
      score: Number(updatedSubmission.grade!.score),
      maxScore: Number(updatedSubmission.grade!.maxScore),
      feedback: updatedSubmission.grade!.feedback || undefined,
      gradedAt: updatedSubmission.grade!.gradedAt.toISOString(),
      returnedAt: updatedSubmission.grade!.returnedAt?.toISOString(),
    },
  };
}

/**
 * Get assignments for a student based on their enrolled courses
 */
export async function getStudentAssignments(
  studentId: string,
  sessionId?: string
): Promise<AssignmentDTO[]> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment || !prisma.studentCourse) {
    throw new Error('Assignment models not found. Please run: cd packages/database && npm run generate');
  }

  // Get student's enrolled courses first (don't block on closing overdue assignments)
  const enrolledCoursesPromise = retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      select: { courseId: true },
    })
  );
  
  // Close overdue assignments in parallel (non-blocking)
  const closeOverduePromise = closeOverdueAssignments().catch(err => {
    console.error('[assignment-service] Error closing overdue assignments:', err);
    return 0; // Don't fail if this errors
  });
  
  // Wait for enrolled courses (required)
  const enrolledCourses = await enrolledCoursesPromise;
  
  // Don't wait for closeOverduePromise - let it run in background
  closeOverduePromise.catch(() => {}); // Suppress unhandled promise rejection

  if (enrolledCourses.length === 0) {
    return [];
  }

  const courseIds = (enrolledCourses as any[]).map((ec: any) => ec.courseId);

  // Build where clause
  // Include PUBLISHED assignments and CLOSED assignments that have submissions (so students can see their submitted work)
  const whereClause: any = {
    courseId: { in: courseIds },
    status: { in: ['PUBLISHED', 'CLOSED'] },
  };

  // If sessionId is provided, filter by session
  if (sessionId) {
    whereClause.sessionId = sessionId;
  }

  const assignments = await retryDbOperation(() =>
    prisma.assignment.findMany({
      where: whereClause,
      include: {
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
        lecturer: {
          select: {
            name: true,
          },
        },
        submissions: {
          where: { 
            studentId,
            // Include all submission statuses - we'll filter on frontend
          },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            grade: {
              select: {
                id: true,
                score: true,
                maxScore: true,
                feedback: true,
                gradedAt: true,
                returnedAt: true,
              },
            },
          },
          take: 1, // Only get the most recent submission
          orderBy: {
            submittedAt: 'desc',
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    })
  );

  return (assignments as any[]).map((assignment: any) => {
    // Get the most recent submission (should only be one due to unique constraint, but take first just in case)
    const studentSubmission = assignment.submissions.length > 0 ? assignment.submissions[0] : undefined;
    
    return {
      id: assignment.id,
      courseId: assignment.courseId,
      courseCode: assignment.course.code,
      courseTitle: assignment.course.title,
      lecturerId: assignment.lecturerId,
      lecturerName: assignment.lecturer.name,
      sessionId: assignment.sessionId,
      sessionName: assignment.session.name,
      title: assignment.title,
      description: assignment.description || undefined,
      instructions: assignment.instructions || undefined,
      dueDate: assignment.dueDate.toISOString(),
      maxScore: Number(assignment.maxScore),
      attachments: assignment.attachments,
      status: assignment.status,
      submissionCount: assignment.submissions.length,
      gradedCount: 0,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
      // Add student-specific submission info
      studentSubmission: studentSubmission
        ? {
            id: studentSubmission.id,
            status: studentSubmission.status,
            submittedAt: studentSubmission.submittedAt.toISOString(),
            grade: studentSubmission.grade
              ? {
                  score: Number(studentSubmission.grade.score),
                  maxScore: Number(studentSubmission.grade.maxScore),
                  feedback: studentSubmission.grade.feedback || undefined,
                  gradedAt: studentSubmission.grade.gradedAt?.toISOString(),
                  returnedAt: studentSubmission.grade.returnedAt?.toISOString(),
                }
              : undefined,
          }
        : undefined,
    };
  });
}

/**
 * Get missed assignments for a student (CLOSED assignments without submission)
 */
export async function getStudentMissedAssignments(
  studentId: string,
  sessionId?: string
): Promise<AssignmentDTO[]> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment || !prisma.studentCourse) {
    throw new Error('Assignment models not found. Please run: cd packages/database && npm run generate');
  }

  // Get student's enrolled courses first (don't block on closing overdue assignments)
  const enrolledCoursesPromise = retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      select: { courseId: true },
    })
  );
  
  // Close overdue assignments in parallel (non-blocking)
  const closeOverduePromise = closeOverdueAssignments().catch(err => {
    console.error('[assignment-service] Error closing overdue assignments:', err);
    return 0; // Don't fail if this errors
  });
  
  // Wait for enrolled courses (required)
  const enrolledCourses = await enrolledCoursesPromise;
  
  // Don't wait for closeOverduePromise - let it run in background
  closeOverduePromise.catch(() => {}); // Suppress unhandled promise rejection

  if (enrolledCourses.length === 0) {
    return [];
  }

  const courseIds = (enrolledCourses as any[]).map((ec: any) => ec.courseId);

  // Build where clause - only CLOSED assignments
  const whereClause: any = {
    courseId: { in: courseIds },
    status: 'CLOSED',
  };

  // If sessionId is provided, filter by session
  if (sessionId) {
    whereClause.sessionId = sessionId;
  }

  const assignments = await retryDbOperation(() =>
    prisma.assignment.findMany({
      where: whereClause,
      include: {
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
        lecturer: {
          select: {
            name: true,
          },
        },
        submissions: {
          where: { studentId },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        dueDate: 'desc',
      },
    })
  );

  // Filter to only include assignments where the student has NO submission
  const missedAssignments = assignments.filter(assignment => assignment.submissions.length === 0);

  return missedAssignments.map((assignment) => {
    return {
      id: assignment.id,
      courseId: assignment.courseId,
      courseCode: assignment.course.code,
      courseTitle: assignment.course.title,
      lecturerId: assignment.lecturerId,
      lecturerName: assignment.lecturer.name,
      sessionId: assignment.sessionId,
      sessionName: assignment.session.name,
      title: assignment.title,
      description: assignment.description || undefined,
      instructions: assignment.instructions || undefined,
      dueDate: assignment.dueDate.toISOString(),
      maxScore: Number(assignment.maxScore),
      attachments: assignment.attachments,
      status: assignment.status,
      submissionCount: 0,
      gradedCount: 0,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
      // No studentSubmission for missed assignments
      studentSubmission: undefined,
    };
  });
}

/**
 * Get graded assignments for a student (assignments that have been graded and returned)
 */
export async function getStudentGradedAssignments(
  studentId: string,
  sessionId?: string
): Promise<AssignmentDTO[]> {
  // Check if Assignment model exists in Prisma client
  if (!prisma.assignment || !prisma.assignmentSubmission || !prisma.studentCourse) {
    throw new Error('Assignment models not found. Please run: cd packages/database && npm run generate');
  }

  // Get student's enrolled courses
  const enrolledCourses = await retryDbOperation(() =>
    prisma.studentCourse.findMany({
      where: { studentId },
      select: { courseId: true },
    })
  );

  if (enrolledCourses.length === 0) {
    return [];
  }

  const courseIds = (enrolledCourses as any[]).map((ec: any) => ec.courseId);

  // Build where clause - get all assignments first, then filter by submissions
  const whereClause: any = {
    courseId: { in: courseIds },
    status: 'PUBLISHED',
  };

  // If sessionId is provided, filter by session
  if (sessionId) {
    whereClause.sessionId = sessionId;
  }

  const assignments = await retryDbOperation(() =>
    prisma.assignment.findMany({
      where: whereClause,
      include: {
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
        lecturer: {
          select: {
            name: true,
          },
        },
        submissions: {
          where: {
            studentId,
            status: 'RETURNED', // Only get returned submissions
          },
          include: {
            grade: {
              select: {
                id: true,
                score: true,
                maxScore: true,
                feedback: true,
                gradedAt: true,
                returnedAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        dueDate: 'desc',
      },
    })
  );

  // Filter to only include assignments with graded and returned submissions
  const gradedAssignments = assignments.filter(assignment => {
    return assignment.submissions.some(sub => 
      sub.status === 'RETURNED' && sub.grade !== null
    );
  });

  return gradedAssignments.map((assignment) => {
    const studentSubmission = assignment.submissions.find(sub => 
      sub.status === 'RETURNED' && sub.grade !== null
    );
    return {
      id: assignment.id,
      courseId: assignment.courseId,
      courseCode: assignment.course.code,
      courseTitle: assignment.course.title,
      lecturerId: assignment.lecturerId,
      lecturerName: assignment.lecturer.name,
      sessionId: assignment.sessionId,
      sessionName: assignment.session.name,
      title: assignment.title,
      description: assignment.description || undefined,
      instructions: assignment.instructions || undefined,
      dueDate: assignment.dueDate.toISOString(),
      maxScore: Number(assignment.maxScore),
      attachments: assignment.attachments,
      status: assignment.status,
      submissionCount: assignment.submissions.length,
      gradedCount: 0,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
      // Add student-specific submission info with grade
      studentSubmission: studentSubmission
        ? {
            id: studentSubmission.id,
            status: studentSubmission.status,
            submittedAt: studentSubmission.submittedAt.toISOString(),
            grade: studentSubmission.grade
              ? {
                  score: Number(studentSubmission.grade.score),
                  maxScore: Number(studentSubmission.grade.maxScore),
                  feedback: studentSubmission.grade.feedback || undefined,
                  gradedAt: studentSubmission.grade.gradedAt.toISOString(),
                  returnedAt: studentSubmission.grade.returnedAt?.toISOString(),
                }
              : undefined,
          }
        : undefined,
    } as any;
  });
}

/**
 * Submit an assignment as a student
 */
export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  content?: string,
  attachments: string[] = []
): Promise<any> {
  // Check if Assignment models exist in Prisma client
  if (!prisma.assignment || !prisma.assignmentSubmission) {
    throw new Error('Assignment models not found. Please run: cd packages/database && npm run generate');
  }

  // Verify assignment exists and is published
  const assignment: any = await retryDbOperation(() =>
    prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        status: true,
        dueDate: true,
        courseId: true,
      },
    })
  );

  if (!assignment) {
    throw new Error('Assignment not found');
  }

  const a = assignment as any;
  if (a.status !== 'PUBLISHED') {
    throw new Error('Assignment is not available for submission');
  }

  // Check if due date has passed
  if (new Date(a.dueDate) < new Date()) {
    throw new Error('Assignment due date has passed');
  }

  // Verify student (Visitor) exists and is a STUDENT
  const student = await retryDbOperation(() =>
    prisma.visitor.findUnique({
      where: { id: studentId },
      select: { id: true, visitorType: true, name: true, email: true },
    })
  );

  if (!student) {
    throw new Error(`Student with ID ${studentId} not found. Please ensure you are logged in correctly.`);
  }

  const s = student as any;
  if (s.visitorType !== 'STUDENT') {
    throw new Error(`User ${studentId} is not a student (type: ${s.visitorType}). Only students can submit assignments.`);
  }

  // Verify student is enrolled in the course
  const enrollment = await retryDbOperation(() =>
    prisma.studentCourse.findFirst({
      where: {
        studentId,
        courseId: a.courseId,
      },
    })
  );

  if (!enrollment) {
    console.error(`[submitAssignment] Student ${studentId} (${student.email}) is not enrolled in course ${assignment.courseId}`);
    throw new Error('You are not enrolled in this course. Please contact your administrator to enroll you.');
  }

  // Check if student has already submitted
  const existingSubmission = await retryDbOperation(() =>
    prisma.assignmentSubmission.findFirst({
      where: {
        assignmentId,
        studentId,
      },
    })
  );

  if (existingSubmission) {
    throw new Error('You have already submitted this assignment');
  }

  // Validate that at least content or attachments are provided
  if ((!content || content.trim() === '') && (!attachments || attachments.length === 0)) {
    throw new Error('Please provide either submission content or attach files');
  }

  // Create submission
  console.log(`[submitAssignment] Creating submission for student ${studentId} on assignment ${assignmentId}`);
  
  const submission = await retryDbOperation(() =>
    prisma.assignmentSubmission.create({
      data: {
        assignmentId,
        studentId,
        content: content || null,
        attachments,
        status: 'SUBMITTED',
      },
      include: {
        assignment: {
          select: {
            title: true,
            course: {
              select: {
                code: true,
                title: true,
              },
            },
          },
        },
      },
    })
  );

  console.log(`[submitAssignment] Successfully created submission ${submission.id} for student ${studentId}`);

  const sub = submission as any;
  return {
    id: sub.id,
    assignmentId: sub.assignmentId,
    assignmentTitle: sub.assignment?.title,
    studentId: sub.studentId,
    content: sub.content || undefined,
    attachments: sub.attachments,
    submittedAt: sub.submittedAt?.toISOString?.() || sub.submittedAt,
    status: sub.status,
  };
}



