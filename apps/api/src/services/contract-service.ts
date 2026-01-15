import { prisma } from '@cms/database';
import { randomUUID } from 'crypto';
import { closeOtherApplications } from './application-service';
import { createNotification } from './notification-service';
import { releaseContractEscrow } from './wallet-service';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export const contractStatusValues = ['ACTIVE', 'FUNDED', 'SUBMITTED', 'COMPLETED', 'DISPUTED', 'CANCELLED'] as const;

export type ContractStatus = (typeof contractStatusValues)[number];

export type ContractCreateInput = {
  gigId: string;
  applicationId: string;
  agreedPrice: number;
  dueDate?: string;
};

export type ContractDTO = {
  id: string;
  gigId: string;
  employerId: string;
  workerId: string;
  applicationId?: string;
  agreedPrice: number;
  startDate: string;
  dueDate?: string;
  status: ContractStatus;
  workSubmissionUrl?: string;
  workSubmissionNotes?: string;
  submittedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  gig?: {
    id: string;
    title: string;
  };
  employer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  worker?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

type ContractRecord = {
  id: string;
  gigId: string;
  employerId: string;
  workerId: string;
  applicationId: string | null;
  agreedPrice: number;
  startDate: Date | string;
  dueDate: Date | string | null;
  status: ContractStatus;
  workSubmissionUrl: string | null;
  workSubmissionNotes: string | null;
  submittedAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  gig?: {
    id: string;
    title: string;
  };
  employer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  worker?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

const toDTO = (contract: ContractRecord): ContractDTO => ({
  id: contract.id,
  gigId: contract.gigId,
  employerId: contract.employerId,
  workerId: contract.workerId,
  applicationId: contract.applicationId ?? undefined,
  agreedPrice: contract.agreedPrice,
  startDate: contract.startDate instanceof Date ? contract.startDate.toISOString() : contract.startDate,
  dueDate: contract.dueDate instanceof Date ? contract.dueDate.toISOString() : contract.dueDate ?? undefined,
  status: contract.status,
  workSubmissionUrl: contract.workSubmissionUrl ?? undefined,
  workSubmissionNotes: contract.workSubmissionNotes ?? undefined,
  submittedAt: contract.submittedAt instanceof Date ? contract.submittedAt.toISOString() : contract.submittedAt ?? undefined,
  completedAt: contract.completedAt instanceof Date ? contract.completedAt.toISOString() : contract.completedAt ?? undefined,
  createdAt: contract.createdAt instanceof Date ? contract.createdAt.toISOString() : contract.createdAt,
  updatedAt: contract.updatedAt instanceof Date ? contract.updatedAt.toISOString() : contract.updatedAt,
  ...(contract.gig && { gig: contract.gig }),
  ...(contract.employer && { employer: contract.employer }),
  ...(contract.worker && { worker: contract.worker })
});

export async function createContract(
  employerId: string,
  input: ContractCreateInput
): Promise<ContractDTO> {
  if (usePrismaStore) {
    // Verify gig exists and user is the owner
    const gig = await prisma.gig.findUnique({
      where: { id: input.gigId },
      select: { ownerId: true, title: true }
    });

    if (!gig) {
      const error = new Error('Gig not found');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    if (gig.ownerId !== employerId) {
      const error = new Error('Only gig owner can create contracts');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    // Verify application exists and is pending
    const application = await prisma.application.findUnique({
      where: { id: input.applicationId },
      include: {
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!application) {
      const error = new Error('Application not found');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    if (application.status !== 'PENDING') {
      const error = new Error('Application is not pending');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    // Check if contract already exists for this application
    const existingContract = await prisma.contract.findUnique({
      where: { applicationId: input.applicationId }
    });

    if (existingContract) {
      const error = new Error('Contract already exists for this application');
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    // Create contract and update application status in a transaction
    const contract = await prisma.$transaction(async (tx) => {
      // Update application status to HIRED
      await tx.application.update({
        where: { id: input.applicationId },
        data: { status: 'HIRED' }
      });

      // Close other applications
      await closeOtherApplications(input.gigId, input.applicationId);

      // Create contract
      const newContract = await tx.contract.create({
        data: {
          gigId: input.gigId,
          employerId,
          workerId: application.applicantId,
          applicationId: input.applicationId,
          agreedPrice: input.agreedPrice,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          status: 'ACTIVE'
        },
        include: {
          gig: {
            select: {
              id: true,
              title: true
            }
          },
          employer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      return newContract;
    });

    // Notify worker
    try {
      const workerName = application.applicant
        ? `${application.applicant.firstName} ${application.applicant.lastName}`
        : 'Worker';
      await createNotification(
        application.applicantId,
        'Application Accepted',
        `Your application for "${gig.title}" has been accepted! A contract has been created.`,
        'GIG',
        { type: 'APPLICATION_HIRED', gigId: input.gigId, gigTitle: gig.title, contractId: contract.id }
      );
    } catch (error) {
      console.error('Error sending contract notification:', error);
    }

    return toDTO(contract as ContractRecord);
  }

  // Demo mode
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    gigId: input.gigId,
    employerId,
    workerId: 'demo-worker',
    applicationId: input.applicationId,
    agreedPrice: input.agreedPrice,
    startDate: now,
    dueDate: input.dueDate,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };
}

export async function getContractById(contractId: string): Promise<ContractDTO | null> {
  if (usePrismaStore) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return contract ? toDTO(contract as ContractRecord) : null;
  }

  return null;
}

export async function getContractsByUser(userId: string): Promise<ContractDTO[]> {
  if (usePrismaStore) {
    const contracts = await prisma.contract.findMany({
      where: {
        OR: [
          { employerId: userId },
          { workerId: userId }
        ]
      },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return contracts.map((contract) => toDTO(contract as ContractRecord));
  }

  return [];
}

export async function getContractByGig(gigId: string): Promise<ContractDTO | null> {
  if (usePrismaStore) {
    const contract = await prisma.contract.findFirst({
      where: { gigId },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return contract ? toDTO(contract as ContractRecord) : null;
  }

  return null;
}

export async function submitWork(
  contractId: string,
  workerId: string,
  workSubmissionUrl: string,
  workSubmissionNotes?: string
): Promise<ContractDTO | null> {
  if (usePrismaStore) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!contract) {
      return null;
    }

    if (contract.workerId !== workerId) {
      const error = new Error('Only the worker can submit work');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    if (contract.status !== 'FUNDED') {
      const error = new Error('Contract must be funded before work can be submitted');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'SUBMITTED',
        workSubmissionUrl,
        workSubmissionNotes: workSubmissionNotes ?? null,
        submittedAt: new Date()
      },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Notify employer
    try {
      await createNotification(
        contract.employerId,
        'Work Submitted',
        `Work has been submitted for "${contract.gig.title}". Please review and approve.`,
        'GIG',
        { type: 'WORK_SUBMITTED', contractId, gigId: contract.gigId, gigTitle: contract.gig.title }
      );
    } catch (error) {
      console.error('Error sending work submission notification:', error);
    }

    return toDTO(updated as ContractRecord);
  }

  return null;
}

export async function approveWork(
  contractId: string,
  employerId: string
): Promise<ContractDTO | null> {
  if (usePrismaStore) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!contract) {
      return null;
    }

    if (contract.employerId !== employerId) {
      const error = new Error('Only the employer can approve work');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    if (contract.status !== 'SUBMITTED') {
      const error = new Error('Contract must be in submitted status');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Release escrow payment to worker
    try {
      await releaseContractEscrow(contractId);
    } catch (error) {
      console.error('Error releasing escrow:', error);
      // Don't fail the approval if escrow release fails - it can be retried
    }

    // Notify worker
    try {
      await createNotification(
        contract.workerId,
        'Work Approved',
        `Your work for "${contract.gig.title}" has been approved! Payment of ₦${contract.agreedPrice.toLocaleString()} has been released to your wallet.`,
        'GIG',
        { type: 'WORK_APPROVED', contractId, gigId: contract.gigId, gigTitle: contract.gig.title, amount: contract.agreedPrice }
      );
    } catch (error) {
      console.error('Error sending work approval notification:', error);
    }

    return toDTO(updated as ContractRecord);
  }

  return null;
}

export async function disputeContract(
  contractId: string,
  userId: string
): Promise<ContractDTO | null> {
  if (usePrismaStore) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    });

    if (!contract) {
      return null;
    }

    if (contract.employerId !== userId && contract.workerId !== userId) {
      const error = new Error('Only contract parties can dispute');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') {
      const error = new Error('Cannot dispute completed or cancelled contract');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'DISPUTED'
      },
      include: {
        gig: {
          select: {
            id: true,
            title: true
          }
        },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return toDTO(updated as ContractRecord);
  }

  return null;
}

