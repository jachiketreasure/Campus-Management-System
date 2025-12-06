import { prisma } from '@cms/database';
import { randomUUID } from 'crypto';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

// New types for exam integrity features
export type ExamContentStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'REQUIRES_CHANGES';
export type VerificationStatus = 'PENDING' | 'IN_PROGRESS' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
export type MonitoringStatus = 'ACTIVE' | 'PAUSED' | 'ENDED' | 'SUSPENDED';
export type MonitoringEventType = 'MULTIPLE_FACES' | 'LOOKING_AWAY' | 'UNAUTHORIZED_DEVICE' | 'SUSPICIOUS_AUDIO' | 'TAB_SWITCH' | 'COPY_PASTE' | 'EXTERNAL_DEVICE' | 'NETWORK_ISSUE' | 'MANUAL_FLAG';
export type MonitoringSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ExamSessionStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';

export type ExamSessionDTO = {
  id: string;
  courseId: string;
  lecturerId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd?: string | null;
  proctoringEnabled: boolean;
  consentRequired: boolean;
  status: ExamSessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExamConsentDTO = {
  examSessionId: string;
  studentId: string;
  consented: boolean;
  consentedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateExamInput = {
  courseId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd?: string;
  proctoringEnabled?: boolean;
  consentRequired?: boolean;
};

const demoExams: ExamSessionDTO[] = [
  {
    id: 'demo-exam-1',
    courseId: 'course-csc401',
    lecturerId: 'demo-lecturer',
    title: 'CSC401 Mid-semester Assessment',
    scheduledStart: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scheduledEnd: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    proctoringEnabled: true,
    consentRequired: true,
    status: 'SCHEDULED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const demoConsents: ExamConsentDTO[] = [
  {
    examSessionId: 'demo-exam-1',
    studentId: 'demo-student',
    consented: true,
    consentedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ipAddress: '127.0.0.1',
    userAgent: 'demo-agent'
  }
];

type ExamRecord = {
  id: string;
  courseId: string;
  lecturerId: string;
  title: string;
  scheduledStart: Date | string;
  scheduledEnd: Date | string | null;
  proctoringEnabled: boolean;
  consentRequired: boolean;
  status: ExamSessionStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const mapExam = (exam: ExamRecord): ExamSessionDTO => ({
  id: exam.id,
  courseId: exam.courseId,
  lecturerId: exam.lecturerId,
  title: exam.title,
  scheduledStart: exam.scheduledStart instanceof Date ? exam.scheduledStart.toISOString() : exam.scheduledStart,
  scheduledEnd:
    exam.scheduledEnd instanceof Date
      ? exam.scheduledEnd.toISOString()
      : exam.scheduledEnd ?? null,
  proctoringEnabled: exam.proctoringEnabled,
  consentRequired: exam.consentRequired,
  status: exam.status,
  createdAt: exam.createdAt instanceof Date ? exam.createdAt.toISOString() : exam.createdAt,
  updatedAt: exam.updatedAt instanceof Date ? exam.updatedAt.toISOString() : exam.updatedAt
});

type ConsentRecord = {
  examSessionId: string;
  studentId: string;
  consented: boolean;
  consentedAt: Date | string;
  ipAddress: string | null;
  userAgent: string | null;
};

const mapConsent = (consent: ConsentRecord): ExamConsentDTO => ({
  examSessionId: consent.examSessionId,
  studentId: consent.studentId,
  consented: consent.consented,
  consentedAt: consent.consentedAt instanceof Date ? consent.consentedAt.toISOString() : consent.consentedAt,
  ipAddress: consent.ipAddress,
  userAgent: consent.userAgent
});

export async function createExamSession(
  lecturerId: string,
  input: CreateExamInput
): Promise<ExamSessionDTO> {
  const payload = {
    courseId: input.courseId,
    title: input.title,
    scheduledStart: new Date(input.scheduledStart),
    scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null,
    proctoringEnabled: input.proctoringEnabled ?? true,
    consentRequired: input.consentRequired ?? true,
    status: 'SCHEDULED' as ExamSessionStatus
  };

  if (usePrismaStore) {
    const exam = await prisma.examSession.create({
      data: {
        ...payload,
        lecturerId
      }
    });

    return mapExam(exam);
  }

  const exam: ExamSessionDTO = {
    id: randomUUID(),
    courseId: payload.courseId,
    lecturerId,
    title: payload.title,
    scheduledStart: payload.scheduledStart.toISOString(),
    scheduledEnd: payload.scheduledEnd?.toISOString() ?? null,
    proctoringEnabled: payload.proctoringEnabled,
    consentRequired: payload.consentRequired,
    status: payload.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  demoExams.push(exam);
  return exam;
}

export async function listExamSessions(lecturerId: string): Promise<ExamSessionDTO[]> {
  if (usePrismaStore) {
    const exams = await prisma.examSession.findMany({
      where: { lecturerId },
      orderBy: { scheduledStart: 'desc' }
    });

    return exams.map(mapExam);
  }

  return demoExams.filter((exam) => exam.lecturerId === lecturerId).sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
}

export async function recordConsent(
  examSessionId: string,
  studentId: string,
  consented: boolean,
  metadata?: { ip?: string; userAgent?: string }
): Promise<ExamConsentDTO> {
  if (usePrismaStore) {
    const consent = await prisma.examConsent.upsert({
      where: {
        examSessionId_studentId: {
          examSessionId,
          studentId
        }
      },
      update: {
        consented,
        consentedAt: new Date(),
        ipAddress: metadata?.ip ?? null,
        userAgent: metadata?.userAgent ?? null
      },
      create: {
        examSessionId,
        studentId,
        consented,
        consentedAt: new Date(),
        ipAddress: metadata?.ip ?? null,
        userAgent: metadata?.userAgent ?? null
      }
    });
    return mapConsent(consent);
  }

  const existingIndex = demoConsents.findIndex(
    (consent) => consent.examSessionId === examSessionId && consent.studentId === studentId
  );

  const consent: ExamConsentDTO = {
    examSessionId,
    studentId,
    consented,
    consentedAt: new Date().toISOString(),
    ipAddress: metadata?.ip ?? null,
    userAgent: metadata?.userAgent ?? null
  };

  if (existingIndex >= 0) {
    demoConsents[existingIndex] = consent;
  } else {
    demoConsents.push(consent);
  }

  return consent;
}

export async function getConsentStatus(
  examSessionId: string,
  studentId: string
): Promise<ExamConsentDTO | null> {
  if (usePrismaStore) {
    const consent = await prisma.examConsent.findUnique({
      where: {
        examSessionId_studentId: {
          examSessionId,
          studentId
        }
      }
    });

    return consent ? mapConsent(consent) : null;
  }

  return demoConsents.find(
    (consent) => consent.examSessionId === examSessionId && consent.studentId === studentId
  ) ?? null;
}

export async function getExamSession(examSessionId: string): Promise<ExamSessionDTO | null> {
  if (usePrismaStore) {
    const exam = await prisma.examSession.findUnique({ where: { id: examSessionId } });
    return exam ? mapExam(exam) : null;
  }

  return demoExams.find((exam) => exam.id === examSessionId) ?? null;
}

// Exam Content Management
export type ExamContentDTO = {
  id: string;
  examSessionId: string;
  lecturerId: string;
  title: string;
  content: string;
  attachments: string[];
  status: ExamContentStatus;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedById?: string | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
};

export type CreateExamContentInput = {
  examSessionId: string;
  title: string;
  content: string;
  attachments?: string[];
};

export type ReviewExamContentInput = {
  status: ExamContentStatus;
  reviewNotes?: string;
  rejectionReason?: string;
};

const mapExamContent = (content: any): ExamContentDTO => ({
  id: content.id,
  examSessionId: content.examSessionId,
  lecturerId: content.lecturerId,
  title: content.title,
  content: content.content,
  attachments: content.attachments,
  status: content.status,
  submittedAt: content.submittedAt instanceof Date ? content.submittedAt.toISOString() : content.submittedAt,
  reviewedAt: content.reviewedAt instanceof Date ? content.reviewedAt.toISOString() : content.reviewedAt ?? null,
  reviewedById: content.reviewedById ?? null,
  reviewNotes: content.reviewNotes ?? null,
  rejectionReason: content.rejectionReason ?? null,
  approvedAt: content.approvedAt instanceof Date ? content.approvedAt.toISOString() : content.approvedAt ?? null,
  approvedById: content.approvedById ?? null,
});

export async function createExamContent(
  lecturerId: string,
  input: CreateExamContentInput
): Promise<ExamContentDTO> {
  if (usePrismaStore) {
    const content = await prisma.examContent.create({
      data: {
        examSessionId: input.examSessionId,
        lecturerId,
        title: input.title,
        content: input.content,
        attachments: input.attachments ?? [],
        status: 'DRAFT'
      }
    });
    return mapExamContent(content);
  }

  // Demo implementation
  const content: ExamContentDTO = {
    id: randomUUID(),
    examSessionId: input.examSessionId,
    lecturerId,
    title: input.title,
    content: input.content,
    attachments: input.attachments ?? [],
    status: 'DRAFT',
    submittedAt: new Date().toISOString()
  };

  return content;
}

export async function submitExamContent(
  contentId: string,
  lecturerId: string
): Promise<ExamContentDTO> {
  if (usePrismaStore) {
    const content = await prisma.examContent.update({
      where: {
        id: contentId,
        lecturerId // Ensure only the lecturer can submit their own content
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date()
      }
    });
    return mapExamContent(content);
  }

  throw new Error('Demo implementation not available for submitExamContent');
}

export async function listExamContentsForReview(): Promise<ExamContentDTO[]> {
  if (usePrismaStore) {
    const contents = await prisma.examContent.findMany({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'REQUIRES_CHANGES'] }
      },
      orderBy: { submittedAt: 'desc' }
    });
    return contents.map(mapExamContent);
  }

  return [];
}

export async function reviewExamContent(
  contentId: string,
  reviewerId: string,
  review: ReviewExamContentInput
): Promise<ExamContentDTO> {
  if (usePrismaStore) {
    const updateData: any = {
      status: review.status,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: review.reviewNotes
    };

    if (review.status === 'REJECTED' && review.rejectionReason) {
      updateData.rejectionReason = review.rejectionReason;
    }

    if (review.status === 'APPROVED') {
      updateData.approvedById = reviewerId;
      updateData.approvedAt = new Date();
    }

    const content = await prisma.examContent.update({
      where: { id: contentId },
      data: updateData
    });

    return mapExamContent(content);
  }

  throw new Error('Demo implementation not available for reviewExamContent');
}

// Student Verification
export type StudentVerificationDTO = {
  id: string;
  examSessionId: string;
  studentId: string;
  status: VerificationStatus;
  idDocumentUrl?: string | null;
  idVerified: boolean;
  faceImageUrl?: string | null;
  faceVerified: boolean;
  cameraAccess: boolean;
  cameraCheckedAt?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
};

export type UpdateVerificationInput = {
  status?: VerificationStatus;
  idDocumentUrl?: string;
  idVerified?: boolean;
  faceImageUrl?: string;
  faceVerified?: boolean;
  cameraAccess?: boolean;
  verificationNotes?: string;
};

const mapStudentVerification = (verification: any): StudentVerificationDTO => ({
  id: verification.id,
  examSessionId: verification.examSessionId,
  studentId: verification.studentId,
  status: verification.status,
  idDocumentUrl: verification.idDocumentUrl ?? null,
  idVerified: verification.idVerified,
  faceImageUrl: verification.faceImageUrl ?? null,
  faceVerified: verification.faceVerified,
  cameraAccess: verification.cameraAccess,
  cameraCheckedAt: verification.cameraCheckedAt instanceof Date ? verification.cameraCheckedAt.toISOString() : verification.cameraCheckedAt ?? null,
  verifiedAt: verification.verifiedAt instanceof Date ? verification.verifiedAt.toISOString() : verification.verifiedAt ?? null,
  verificationNotes: verification.verificationNotes ?? null,
});

export async function getOrCreateStudentVerification(
  examSessionId: string,
  studentId: string
): Promise<StudentVerificationDTO> {
  if (usePrismaStore) {
    const verification = await prisma.studentVerification.upsert({
      where: {
        examSessionId_studentId: {
          examSessionId,
          studentId
        }
      },
      update: {},
      create: {
        examSessionId,
        studentId,
        status: 'PENDING',
        idVerified: false,
        faceVerified: false,
        cameraAccess: false
      }
    });
    return mapStudentVerification(verification);
  }

  // Demo implementation
  const verification: StudentVerificationDTO = {
    id: randomUUID(),
    examSessionId,
    studentId,
    status: 'PENDING',
    idVerified: false,
    faceVerified: false,
    cameraAccess: false
  };

  return verification;
}

export async function updateStudentVerification(
  verificationId: string,
  input: UpdateVerificationInput
): Promise<StudentVerificationDTO> {
  if (usePrismaStore) {
    const updateData: any = {};

    if (input.status) updateData.status = input.status;
    if (input.idDocumentUrl !== undefined) updateData.idDocumentUrl = input.idDocumentUrl;
    if (input.idVerified !== undefined) updateData.idVerified = input.idVerified;
    if (input.faceImageUrl !== undefined) updateData.faceImageUrl = input.faceImageUrl;
    if (input.faceVerified !== undefined) updateData.faceVerified = input.faceVerified;
    if (input.cameraAccess !== undefined) updateData.cameraAccess = input.cameraAccess;
    if (input.verificationNotes !== undefined) updateData.verificationNotes = input.verificationNotes;

    if (input.status === 'VERIFIED') {
      updateData.verifiedAt = new Date();
    }

    if (input.cameraAccess !== undefined) {
      updateData.cameraCheckedAt = new Date();
    }

    const verification = await prisma.studentVerification.update({
      where: { id: verificationId },
      data: updateData
    });

    return mapStudentVerification(verification);
  }

  throw new Error('Demo implementation not available for updateStudentVerification');
}

// Monitoring Sessions
export type MonitoringSessionDTO = {
  id: string;
  examSessionId: string;
  studentId?: string | null;
  monitorId: string;
  status: MonitoringStatus;
  startedAt: string;
  endedAt?: string | null;
  lastActivityAt: string;
  streamUrl?: string | null;
  recordingEnabled: boolean;
};

export type MonitoringEventDTO = {
  id: string;
  monitoringSessionId: string;
  eventType: MonitoringEventType;
  severity: MonitoringSeverity;
  description: string;
  confidenceScore: number;
  flaggedAt: string;
  reviewed: boolean;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
};

export type CreateMonitoringEventInput = {
  monitoringSessionId: string;
  eventType: MonitoringEventType;
  severity: MonitoringSeverity;
  description: string;
  confidenceScore: number;
};

const mapMonitoringSession = (session: any): MonitoringSessionDTO => ({
  id: session.id,
  examSessionId: session.examSessionId,
  studentId: session.studentId ?? null,
  monitorId: session.monitorId,
  status: session.status,
  startedAt: session.startedAt instanceof Date ? session.startedAt.toISOString() : session.startedAt,
  endedAt: session.endedAt instanceof Date ? session.endedAt.toISOString() : session.endedAt ?? null,
  lastActivityAt: session.lastActivityAt instanceof Date ? session.lastActivityAt.toISOString() : session.lastActivityAt,
  streamUrl: session.streamUrl ?? null,
  recordingEnabled: session.recordingEnabled,
});

const mapMonitoringEvent = (event: any): MonitoringEventDTO => ({
  id: event.id,
  monitoringSessionId: event.monitoringSessionId,
  eventType: event.eventType,
  severity: event.severity,
  description: event.description,
  confidenceScore: event.confidenceScore,
  flaggedAt: event.flaggedAt instanceof Date ? event.flaggedAt.toISOString() : event.flaggedAt,
  reviewed: event.reviewed,
  reviewedById: event.reviewedById ?? null,
  reviewedAt: event.reviewedAt instanceof Date ? event.reviewedAt.toISOString() : event.reviewedAt ?? null,
  reviewNotes: event.reviewNotes ?? null,
});

export async function createMonitoringSession(
  examSessionId: string,
  monitorId: string,
  studentId?: string
): Promise<MonitoringSessionDTO> {
  if (usePrismaStore) {
    const session = await prisma.monitoringSession.create({
      data: {
        examSessionId,
        monitorId,
        studentId,
        status: 'ACTIVE',
        recordingEnabled: true
      }
    });
    return mapMonitoringSession(session);
  }

  // Demo implementation
  const session: MonitoringSessionDTO = {
    id: randomUUID(),
    examSessionId,
    monitorId,
    studentId,
    status: 'ACTIVE',
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    recordingEnabled: true
  };

  return session;
}

export async function getActiveMonitoringSessions(examSessionId?: string): Promise<MonitoringSessionDTO[]> {
  if (usePrismaStore) {
    const sessions = await prisma.monitoringSession.findMany({
      where: {
        status: 'ACTIVE',
        ...(examSessionId && { examSessionId })
      },
      orderBy: { startedAt: 'desc' }
    });
    return sessions.map(mapMonitoringSession);
  }

  return [];
}

export async function createMonitoringEvent(
  input: CreateMonitoringEventInput
): Promise<MonitoringEventDTO> {
  if (usePrismaStore) {
    const event = await prisma.monitoringEvent.create({
      data: {
        monitoringSessionId: input.monitoringSessionId,
        eventType: input.eventType,
        severity: input.severity,
        description: input.description,
        confidenceScore: input.confidenceScore,
        reviewed: false
      }
    });
    return mapMonitoringEvent(event);
  }

  throw new Error('Demo implementation not available for createMonitoringEvent');
}

export async function getMonitoringEvents(
  monitoringSessionId?: string,
  examSessionId?: string,
  reviewed?: boolean
): Promise<MonitoringEventDTO[]> {
  if (usePrismaStore) {
    const events = await prisma.monitoringEvent.findMany({
      where: {
        ...(monitoringSessionId && { monitoringSessionId }),
        ...(examSessionId && {
          monitoringSession: { examSessionId }
        }),
        ...(reviewed !== undefined && { reviewed })
      },
      orderBy: { flaggedAt: 'desc' },
      include: {
        monitoringSession: examSessionId ? true : false
      }
    });
    return events.map(mapMonitoringEvent);
  }

  return [];
}

export async function reviewMonitoringEvent(
  eventId: string,
  reviewerId: string,
  reviewNotes?: string
): Promise<MonitoringEventDTO> {
  if (usePrismaStore) {
    const event = await prisma.monitoringEvent.update({
      where: { id: eventId },
      data: {
        reviewed: true,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNotes
      }
    });
    return mapMonitoringEvent(event);
  }

  throw new Error('Demo implementation not available for reviewMonitoringEvent');
}

