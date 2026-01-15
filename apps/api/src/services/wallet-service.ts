import { Prisma, prisma } from '@cms/database';
import { randomUUID } from 'crypto';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export type WalletSummary = {
  userId: string;
  balance: number;
  holds: number;
  available: number;
};

export type TransactionDTO = {
  id: string;
  walletId: string;
  orderId?: string | null;
  contractId?: string | null;
  amount: number;
  type: 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE' | 'DEPOSIT' | 'REFUND';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  reference: string;
  fromUserId?: string | null;
  toUserId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DisputeDTO = {
  id: string;
  orderId: string;
  raisedById: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
  createdAt: string;
  updatedAt: string;
};

type DemoWallet = {
  userId: string;
  balance: number;
  holds: number;
};

const demoWallets = new Map<string, DemoWallet>();
const demoTransactions: TransactionDTO[] = [];
const demoDisputes: DisputeDTO[] = [];

function ensureDemoWallet(userId: string): DemoWallet {
  if (!demoWallets.has(userId)) {
    demoWallets.set(userId, { userId, balance: 15000, holds: 0 });
  }
  return demoWallets.get(userId)!;
}

type TransactionRecord = {
  id: string;
  walletId: string;
  orderId: string | null;
  contractId: string | null;
  amount: number;
  type: 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE' | 'DEPOSIT' | 'REFUND';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  reference: string;
  fromUserId: string | null;
  toUserId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const mapTransaction = (tx: TransactionRecord): TransactionDTO => ({
  id: tx.id,
  walletId: tx.walletId,
  orderId: tx.orderId,
  contractId: tx.contractId,
  amount: Number(tx.amount),
  type: tx.type,
  status: tx.status,
  reference: tx.reference,
  fromUserId: tx.fromUserId,
  toUserId: tx.toUserId,
  createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
  updatedAt: tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : tx.updatedAt
});

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  if (usePrismaStore) {
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId }
    });

    const holds = await prisma.transaction.aggregate({
      where: { walletId: wallet.id, type: 'HOLD', status: 'PENDING' },
      _sum: { amount: true }
    });

    const holdAmount = Number(holds._sum.amount ?? 0);
    const balance = Number(wallet.balance);
    return {
      userId,
      balance,
      holds: holdAmount,
      available: balance - holdAmount
    };
  }

  const wallet = ensureDemoWallet(userId);
  return {
    userId,
    balance: wallet.balance,
    holds: wallet.holds,
    available: wallet.balance - wallet.holds
  };
}

export async function listTransactions(userId: string): Promise<TransactionDTO[]> {
  if (usePrismaStore) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return [];
    }
    const transactions = await prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' }
    });
    return transactions.map(mapTransaction);
  }

  const wallet = ensureDemoWallet(userId);
  return demoTransactions
    .filter((tx) => tx.walletId === wallet.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function holdEscrow(
  sellerId: string,
  orderId: string | null,
  amount: number,
  reference: string
): Promise<void> {
  if (usePrismaStore) {
    const wallet = await prisma.wallet.upsert({
      where: { userId: sellerId },
      update: {},
      create: { userId: sellerId }
    });

    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        orderId,
        amount: amount,
        type: 'HOLD',
        status: 'PENDING',
        reference
      }
    });
    return;
  }

  const wallet = ensureDemoWallet(sellerId);
  wallet.holds += amount;
  const now = new Date().toISOString();
  demoTransactions.push({
    id: randomUUID(),
    walletId: sellerId,
    orderId,
    amount,
    type: 'HOLD',
    status: 'PENDING',
    reference,
    createdAt: now,
    updatedAt: now
  });
}

export async function releaseEscrow(orderId: string): Promise<TransactionDTO | null> {
  if (usePrismaStore) {
    const transaction = await prisma.transaction.findFirst({
      where: { orderId, type: 'HOLD', status: 'PENDING' }
    });
    if (!transaction) {
      return null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const completed = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          type: 'RELEASE',
          updatedAt: new Date()
        }
      });

      await tx.wallet.update({
        where: { id: transaction.walletId },
        data: {
          balance: { increment: transaction.amount }
        }
      });

      return completed;
    });

    return mapTransaction(updated);
  }

  const txIndex = demoTransactions.findIndex(
    (tx) => tx.orderId === orderId && tx.type === 'HOLD' && tx.status === 'PENDING'
  );
  if (txIndex === -1) {
    return null;
  }

  const hold = demoTransactions[txIndex];
  const wallet = ensureDemoWallet(hold.walletId);
  wallet.balance += hold.amount;
  wallet.holds = Math.max(0, wallet.holds - hold.amount);

  const now = new Date().toISOString();
  demoTransactions[txIndex] = {
    ...hold,
    type: 'RELEASE',
    status: 'COMPLETED',
    updatedAt: now
  };

  return demoTransactions[txIndex];
}

export async function listDisputes(): Promise<DisputeDTO[]> {
  if (usePrismaStore) {
    const disputes = await prisma.dispute.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return disputes.map((dispute) => ({
      id: dispute.id,
      orderId: dispute.orderId,
      raisedById: dispute.raisedById,
      description: dispute.description,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString()
    }));
  }

  return demoDisputes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createDispute(
  orderId: string,
  raisedById: string,
  description: string
): Promise<DisputeDTO> {
  if (usePrismaStore) {
    const dispute = await prisma.dispute.create({
      data: {
        orderId,
        raisedById,
        description,
        status: 'OPEN'
      }
    });

    return {
      id: dispute.id,
      orderId: dispute.orderId,
      raisedById: dispute.raisedById,
      description: dispute.description,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString()
    };
  }

  const now = new Date().toISOString();
  const dispute: DisputeDTO = {
    id: randomUUID(),
    orderId,
    raisedById,
    description,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now
  };
  demoDisputes.push(dispute);
  return dispute;
}

/**
 * Deposit payment into escrow for a contract
 * This deducts from employer's wallet and holds it in escrow
 */
export async function depositToEscrow(
  contractId: string,
  employerId: string,
  amount: number
): Promise<TransactionDTO> {
  if (usePrismaStore) {
    // Verify contract exists and user is the employer
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        gig: {
          select: {
            title: true
          }
        }
      }
    });

    if (!contract) {
      const error = new Error('Contract not found');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    if (contract.employerId !== employerId) {
      const error = new Error('Only the employer can deposit to escrow');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    if (contract.status !== 'ACTIVE') {
      const error = new Error('Contract must be active to deposit');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    if (Math.abs(contract.agreedPrice - amount) > 0.01) {
      const error = new Error(`Deposit amount must match agreed price: ₦${contract.agreedPrice}`);
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const employerWallet = await prisma.wallet.upsert({
      where: { userId: employerId },
      update: {},
      create: { userId: employerId }
    });

    // Check if employer has sufficient balance
    if (Number(employerWallet.balance) < amount) {
      const error = new Error('Insufficient balance');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const reference = `DEPOSIT-${contractId}-${Date.now()}`;

    const transaction = await prisma.$transaction(async (tx) => {
      // Deduct from employer wallet
      await tx.wallet.update({
        where: { id: employerWallet.id },
        data: {
          balance: { decrement: amount }
        }
      });

      // Create deposit transaction
      const depositTx = await tx.transaction.create({
        data: {
          walletId: employerWallet.id,
          contractId,
          amount,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          reference,
          fromUserId: employerId,
          toUserId: null, // Escrow - no recipient yet
          metadata: {
            contractId,
            purpose: 'escrow_deposit'
          }
        }
      });

      // Update contract status to FUNDED
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'FUNDED'
        }
      });

      return depositTx;
    });

    return mapTransaction(transaction as TransactionRecord);
  }

  // Demo mode
  const wallet = ensureDemoWallet(employerId);
  if (wallet.balance < amount) {
    const error = new Error('Insufficient balance');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }

  wallet.balance -= amount;
  const now = new Date().toISOString();
  const transaction: TransactionDTO = {
    id: randomUUID(),
    walletId: employerId,
    contractId,
    amount,
    type: 'DEPOSIT',
    status: 'COMPLETED',
    reference: `DEPOSIT-${contractId}-${Date.now()}`,
    fromUserId: employerId,
    toUserId: null,
    createdAt: now,
    updatedAt: now
  };
  demoTransactions.push(transaction);
  return transaction;
}

/**
 * Release escrow payment to worker when work is approved
 */
export async function releaseContractEscrow(
  contractId: string
): Promise<TransactionDTO | null> {
  if (usePrismaStore) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        gig: {
          select: {
            title: true
          }
        }
      }
    });

    if (!contract) {
      return null;
    }

    if (contract.status !== 'COMPLETED') {
      const error = new Error('Contract must be completed to release payment');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    // Check if payment already released
    const existingRelease = await prisma.transaction.findFirst({
      where: {
        contractId,
        type: 'RELEASE',
        status: 'COMPLETED'
      }
    });

    if (existingRelease) {
      const error = new Error('Payment already released');
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    const workerWallet = await prisma.wallet.upsert({
      where: { userId: contract.workerId },
      update: {},
      create: { userId: contract.workerId }
    });

    const reference = `RELEASE-${contractId}-${Date.now()}`;

    const transaction = await prisma.$transaction(async (tx) => {
      // Credit worker wallet
      await tx.wallet.update({
        where: { id: workerWallet.id },
        data: {
          balance: { increment: contract.agreedPrice }
        }
      });

      // Create release transaction
      const releaseTx = await tx.transaction.create({
        data: {
          walletId: workerWallet.id,
          contractId,
          amount: contract.agreedPrice,
          type: 'RELEASE',
          status: 'COMPLETED',
          reference,
          fromUserId: null, // From escrow
          toUserId: contract.workerId,
          metadata: {
            contractId,
            purpose: 'escrow_release'
          }
        }
      });

      return releaseTx;
    });

    return mapTransaction(transaction as TransactionRecord);
  }

  // Demo mode
  const txIndex = demoTransactions.findIndex(
    (tx) => tx.contractId === contractId && tx.type === 'DEPOSIT' && tx.status === 'COMPLETED'
  );
  if (txIndex === -1) {
    return null;
  }

  const deposit = demoTransactions[txIndex];
  const workerWallet = ensureDemoWallet(deposit.toUserId || 'worker');
  workerWallet.balance += deposit.amount;

  const now = new Date().toISOString();
  const releaseTx: TransactionDTO = {
    id: randomUUID(),
    walletId: deposit.toUserId || 'worker',
    contractId,
    amount: deposit.amount,
    type: 'RELEASE',
    status: 'COMPLETED',
    reference: `RELEASE-${contractId}-${Date.now()}`,
    fromUserId: null,
    toUserId: deposit.toUserId || 'worker',
    createdAt: now,
    updatedAt: now
  };
  demoTransactions.push(releaseTx);
  return releaseTx;
}

