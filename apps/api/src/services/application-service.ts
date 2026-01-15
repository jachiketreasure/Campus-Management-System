import { prisma } from '@cms/database';
import { randomUUID } from 'crypto';
import { createNotification } from './notification-service';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export const applicationStatusValues = ['PENDING', 'HIRED', 'REJECTED', 'CLOSED'] as const;

export type ApplicationStatus = (typeof applicationStatusValues)[number];

export type ApplicationCreateInput = {
  gigId: string;
  message?: string;
  attachmentUrl?: string;
};

export type ApplicationDTO = {
  id: string;
  gigId: string;
  applicantId: string;
  message?: string;
  attachmentUrl?: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  applicant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile?: {
      avatarUrl?: string;
      bio?: string;
    };
  };
};

type ApplicationRecord = {
  id: string;
  gigId: string;
  applicantId: string;
  message: string | null;
  attachmentUrl: string | null;
  status: ApplicationStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  applicant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile?: {
      avatarUrl: string | null;
      bio: string | null;
    } | null;
  };
};

const toDTO = (app: ApplicationRecord): ApplicationDTO => ({
  id: app.id,
  gigId: app.gigId,
  applicantId: app.applicantId,
  message: app.message ?? undefined,
  attachmentUrl: app.attachmentUrl ?? undefined,
  status: app.status,
  createdAt: app.createdAt instanceof Date ? app.createdAt.toISOString() : app.createdAt,
  updatedAt: app.updatedAt instanceof Date ? app.updatedAt.toISOString() : app.updatedAt,
  ...(app.applicant && {
    applicant: {
      id: app.applicant.id,
      firstName: app.applicant.firstName,
      lastName: app.applicant.lastName,
      email: app.applicant.email,
      ...(app.applicant.profile && {
        profile: {
          avatarUrl: app.applicant.profile.avatarUrl ?? undefined,
          bio: app.applicant.profile.bio ?? undefined
        }
      })
    }
  })
});

export async function createApplication(
  applicantId: string,
  input: ApplicationCreateInput
): Promise<ApplicationDTO> {
  if (usePrismaStore) {
    // Check if gig exists
    const gig = await prisma.gig.findUnique({
      where: { id: input.gigId },
      select: { ownerId: true }
    });

    if (!gig) {
      const error = new Error('Gig not found');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    // Prevent gig owner from applying
    if (gig.ownerId === applicantId) {
      const error = new Error('Gig owner cannot apply to their own gig');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    // Check for duplicate application
    const existing = await prisma.application.findUnique({
      where: {
        gigId_applicantId: {
          gigId: input.gigId,
          applicantId
        }
      }
    });

    if (existing) {
      const error = new Error('You have already applied for this gig');
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    const created = await prisma.application.create({
      data: {
        gigId: input.gigId,
        applicantId,
        message: input.message ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        status: 'PENDING'
      },
      include: {
        applicant: {
          include: {
            profile: true
          }
        },
        gig: {
          select: {
            title: true,
            ownerId: true
          }
        }
      }
    });

    // Notify gig owner about new application
    try {
      const applicantName = created.applicant
        ? `${created.applicant.firstName} ${created.applicant.lastName}`
        : 'A student';
      await createNotification(
        gig.ownerId,
        'New Application Received',
        `${applicantName} applied for "${created.gig.title}"`,
        'GIG',
        { type: 'NEW_APPLICATION', gigId: input.gigId, gigTitle: created.gig.title, applicantId, applicantName }
      );
    } catch (error) {
      // Don't fail application creation if notification fails
      console.error('Error sending new application notification:', error);
    }

    return toDTO(created as ApplicationRecord);
  }

  // Demo mode - return mock data
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    gigId: input.gigId,
    applicantId,
    message: input.message,
    attachmentUrl: input.attachmentUrl,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now
  };
}

export async function getApplicationsByGig(gigId: string): Promise<ApplicationDTO[]> {
  if (usePrismaStore) {
    const applications = await prisma.application.findMany({
      where: { gigId },
      include: {
        applicant: {
          include: {
            profile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return applications.map((app) => toDTO(app as ApplicationRecord));
  }

  return [];
}

export async function getApplicationById(applicationId: string): Promise<ApplicationDTO | null> {
  if (usePrismaStore) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicant: {
          include: {
            profile: true
          }
        }
      }
    });

    return application ? toDTO(application as ApplicationRecord) : null;
  }

  return null;
}

export async function getUserApplicationForGig(
  gigId: string,
  userId: string
): Promise<ApplicationDTO | null> {
  if (usePrismaStore) {
    const application = await prisma.application.findUnique({
      where: {
        gigId_applicantId: {
          gigId,
          applicantId: userId
        }
      },
      include: {
        applicant: {
          include: {
            profile: true
          }
        }
      }
    });

    return application ? toDTO(application as ApplicationRecord) : null;
  }

  return null;
}

export async function updateApplicationStatus(
  applicationId: string,
  gigOwnerId: string,
  status: ApplicationStatus
): Promise<ApplicationDTO | null> {
  if (usePrismaStore) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        gig: {
          select: { ownerId: true }
        }
      }
    });

    if (!application) {
      return null;
    }

    // Only gig owner can update application status
    if (application.gig.ownerId !== gigOwnerId) {
      const error = new Error('Only gig owner can update application status');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { status },
      include: {
        applicant: {
          include: {
            profile: true
          }
        }
      }
    });

    return toDTO(updated as ApplicationRecord);
  }

  return null;
}

export async function rejectApplication(
  applicationId: string,
  gigOwnerId: string
): Promise<ApplicationDTO | null> {
  return updateApplicationStatus(applicationId, gigOwnerId, 'REJECTED');
}

export async function closeOtherApplications(
  gigId: string,
  hiredApplicationId: string
): Promise<void> {
  if (usePrismaStore) {
    await prisma.application.updateMany({
      where: {
        gigId,
        id: { not: hiredApplicationId },
        status: { not: 'HIRED' }
      },
      data: {
        status: 'CLOSED'
      }
    });
  }
}

