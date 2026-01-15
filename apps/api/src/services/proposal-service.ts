import { Prisma, prisma } from '@cms/database';
import { randomUUID } from 'crypto';
import { holdEscrow } from './wallet-service';
import { notifyProposalAccepted, notifyProposalRejected, notifyNewProposal } from './notification-service';
import { getGigById } from './gig-service';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export const proposalStatusValues = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const;
export const orderStatusValues = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'] as const;

export type ProposalStatus = (typeof proposalStatusValues)[number];
export type OrderStatus = (typeof orderStatusValues)[number];

export type ProposalDTO = {
  id: string;
  gigId: string;
  proposerId: string;
  message: string;
  amount: number;
  deliveryTimeDays: number;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProposalCreateInput = {
  gigId: string;
  message: string;
  amount: number;
  deliveryTimeDays: number;
};

export type OrderDTO = {
  id: string;
  gigId: string;
  buyerId: string;
  sellerId: string;
  proposalId?: string;
  amount: number;
  status: OrderStatus;
  escrowReleased: boolean;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderCreateInput = {
  gigId: string;
  proposalId?: string;
};

const demoProposals: ProposalDTO[] = [];
const demoOrders: OrderDTO[] = [];

type ProposalRecord = {
  id: string;
  gigId: string;
  proposerId: string;
  message: string;
  amount: number;
  deliveryTimeDays: number;
  status: ProposalStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type OrderRecord = {
  id: string;
  gigId: string;
  buyerId: string;
  sellerId: string;
  proposalId: string | null;
  amount: number;
  status: OrderStatus;
  escrowReleased: boolean;
  dueDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const mapProposal = (proposal: ProposalRecord): ProposalDTO => ({
  id: proposal.id,
  gigId: proposal.gigId,
  proposerId: proposal.proposerId,
  message: proposal.message,
  amount: Number(proposal.amount),
  deliveryTimeDays: proposal.deliveryTimeDays,
  status: proposal.status,
  createdAt: proposal.createdAt instanceof Date ? proposal.createdAt.toISOString() : proposal.createdAt,
  updatedAt: proposal.updatedAt instanceof Date ? proposal.updatedAt.toISOString() : proposal.updatedAt
});

const mapOrder = (order: OrderRecord): OrderDTO => ({
  id: order.id,
  gigId: order.gigId,
  buyerId: order.buyerId,
  sellerId: order.sellerId,
  proposalId: order.proposalId ?? undefined,
  amount: Number(order.amount),
  status: order.status,
  escrowReleased: order.escrowReleased,
  dueDate: order.dueDate instanceof Date ? order.dueDate.toISOString() : order.dueDate ?? null,
  createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
  updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt
});

export async function createProposal(
  proposerId: string,
  input: ProposalCreateInput
): Promise<ProposalDTO> {
  const payload = {
    gigId: input.gigId,
    proposerId,
    message: input.message,
    amount: input.amount,
    deliveryTimeDays: input.deliveryTimeDays
  };

  if (usePrismaStore) {
    const proposal = await prisma.proposal.create({
      data: {
        ...payload,
        amount: payload.amount
      }
    });
    
    // Notify gig owner about new proposal
    try {
      const gig = await getGigById(payload.gigId);
      if (gig) {
        const proposer = await prisma.user.findUnique({ where: { id: proposerId }, select: { firstName: true, lastName: true } });
        const proposerName = proposer ? `${proposer.firstName} ${proposer.lastName}` : 'A student';
        await notifyNewProposal(gig.ownerId, gig.title, proposerName);
      }
    } catch (error) {
      // Don't fail proposal creation if notification fails
      console.error('Error sending new proposal notification:', error);
    }
    
    return mapProposal(proposal);
  }

  const now = new Date().toISOString();
  const proposal: ProposalDTO = {
    id: randomUUID(),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    ...payload
  };
  demoProposals.push(proposal);
  
  // Notify gig owner about new proposal (demo mode)
  try {
    const gig = await getGigById(payload.gigId);
    if (gig) {
      await notifyNewProposal(gig.ownerId, gig.title, 'A student');
    }
  } catch (error) {
    console.error('Error sending new proposal notification:', error);
  }
  
  return proposal;
}

export async function listProposalsForGig(gigId: string): Promise<ProposalDTO[]> {
  if (usePrismaStore) {
    const proposals = await prisma.proposal.findMany({
      where: { gigId },
      orderBy: { createdAt: 'desc' }
    });
    return proposals.map(mapProposal);
  }

  return demoProposals.filter((proposal) => proposal.gigId === gigId);
}

export async function acceptProposal(
  proposalId: string,
  buyerId: string,
  sellerId: string
): Promise<OrderDTO> {
  if (usePrismaStore) {
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) {
      throw Object.assign(new Error('Proposal not found'), { statusCode: 404 });
    }

    const order = await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: { status: 'ACCEPTED' }
      });

      const createdOrder = await tx.order.create({
        data: {
          gigId: proposal.gigId,
          buyerId,
          sellerId,
          proposalId,
          amount: proposal.amount,
          status: 'IN_PROGRESS'
        }
      });

      return createdOrder;
    });

    await holdEscrow(sellerId, order.id, Number(proposal.amount), `ESCROW-${order.id}`);

    // Notify proposer about acceptance
    try {
      const gig = await getGigById(proposal.gigId);
      if (gig) {
        await notifyProposalAccepted(proposal.proposerId, gig.title, Number(proposal.amount));
      }
    } catch (error) {
      console.error('Error sending proposal accepted notification:', error);
    }

    return mapOrder(order);
  }

  const index = demoProposals.findIndex((proposal) => proposal.id === proposalId);
  if (index === -1) {
    throw Object.assign(new Error('Proposal not found'), { statusCode: 404 });
  }

  demoProposals[index] = {
    ...demoProposals[index],
    status: 'ACCEPTED',
    updatedAt: new Date().toISOString()
  };

  const order: OrderDTO = {
    id: randomUUID(),
    gigId: demoProposals[index].gigId,
    buyerId,
    sellerId,
    proposalId,
    amount: demoProposals[index].amount,
    status: 'IN_PROGRESS',
    escrowReleased: false,
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  demoOrders.push(order);
  await holdEscrow(sellerId, order.id, order.amount, `ESCROW-${order.id}`);
  
  // Notify proposer about acceptance (demo mode)
  try {
    const gig = await getGigById(demoProposals[index].gigId);
    if (gig) {
      await notifyProposalAccepted(demoProposals[index].proposerId, gig.title, demoProposals[index].amount);
    }
  } catch (error) {
    console.error('Error sending proposal accepted notification:', error);
  }
  
  return order;
}

export async function rejectProposal(proposalId: string): Promise<ProposalDTO> {
  if (usePrismaStore) {
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) {
      throw Object.assign(new Error('Proposal not found'), { statusCode: 404 });
    }

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'REJECTED', updatedAt: new Date() }
    });
    
    // Notify proposer about rejection
    try {
      const gig = await getGigById(proposal.gigId);
      if (gig) {
        await notifyProposalRejected(proposal.proposerId, gig.title);
      }
    } catch (error) {
      console.error('Error sending proposal rejected notification:', error);
    }
    
    return mapProposal(updated);
  }

  const index = demoProposals.findIndex((proposal) => proposal.id === proposalId);
  if (index === -1) {
    throw Object.assign(new Error('Proposal not found'), { statusCode: 404 });
  }

  demoProposals[index] = {
    ...demoProposals[index],
    status: 'REJECTED',
    updatedAt: new Date().toISOString()
  };
  
  // Notify proposer about rejection (demo mode)
  try {
    const gig = await getGigById(demoProposals[index].gigId);
    if (gig) {
      await notifyProposalRejected(demoProposals[index].proposerId, gig.title);
    }
  } catch (error) {
    console.error('Error sending proposal rejected notification:', error);
  }
  
  return demoProposals[index];
}

export async function listOrdersForUser(userId: string): Promise<OrderDTO[]> {
  if (usePrismaStore) {
    const orders = await prisma.order.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }]
      },
      orderBy: { createdAt: 'desc' }
    });
    return orders.map(mapOrder);
  }

  return demoOrders.filter((order) => order.buyerId === userId || order.sellerId === userId);
}

