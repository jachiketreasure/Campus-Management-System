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
  amount: number;
  type: 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  reference: string;
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
  amount: Prisma.Decimal | number;
  type: 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  reference: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const mapTransaction = (tx: TransactionRecord): TransactionDTO => ({
  id: tx.id,
  walletId: tx.walletId,
  orderId: tx.orderId,
  amount: Number(tx.amount),
  type: tx.type,
  status: tx.status,
  reference: tx.reference,
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

