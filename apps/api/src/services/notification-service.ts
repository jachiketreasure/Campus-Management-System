import { Prisma, prisma } from '@cms/database';
import { randomUUID } from 'crypto';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export type NotificationCategory = 
  | 'SYSTEM'
  | 'GIG'
  | 'ATTENDANCE'
  | 'EXAM'
  | 'MALPRACTICE'
  | 'FINANCE';

export type NotificationDTO = {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  read: boolean;
  data?: Record<string, any>;
  readAt?: string | null;
  malpracticeEventId?: string | null;
  createdAt: string;
};

type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  read: boolean;
  data: any;
  readAt: Date | string | null;
  malpracticeEventId: string | null;
  createdAt: Date | string;
};

const mapNotification = (notification: NotificationRecord): NotificationDTO => ({
  id: notification.id,
  userId: notification.userId,
  title: notification.title,
  body: notification.body,
  category: notification.category,
  read: notification.read,
  data: notification.data ? (typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data) : undefined,
  readAt: notification.readAt instanceof Date ? notification.readAt.toISOString() : notification.readAt ?? null,
  malpracticeEventId: notification.malpracticeEventId ?? null,
  createdAt: notification.createdAt instanceof Date ? notification.createdAt.toISOString() : notification.createdAt,
});

const demoNotifications: NotificationDTO[] = [];

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  category: NotificationCategory,
  data?: Record<string, any>,
  malpracticeEventId?: string
): Promise<NotificationDTO> {
  if (usePrismaStore) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        category,
        data: data ? (data as any) : undefined,
        malpracticeEventId: malpracticeEventId ?? null,
      },
    });
    return mapNotification(notification);
  }

  const now = new Date().toISOString();
  const notification: NotificationDTO = {
    id: randomUUID(),
    userId,
    title,
    body,
    category,
    read: false,
    data,
    readAt: null,
    malpracticeEventId: malpracticeEventId ?? null,
    createdAt: now,
  };
  demoNotifications.push(notification);
  return notification;
}

export async function listNotifications(
  userId: string,
  options?: {
    category?: NotificationCategory;
    read?: boolean;
    limit?: number;
  }
): Promise<NotificationDTO[]> {
  if (usePrismaStore) {
    const where: Prisma.NotificationWhereInput = {
      userId,
    };
    if (options?.category) {
      where.category = options.category;
    }
    if (options?.read !== undefined) {
      where.read = options.read;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
    });
    return notifications.map(mapNotification);
  }

  let filtered = demoNotifications.filter((n) => n.userId === userId);
  if (options?.category) {
    filtered = filtered.filter((n) => n.category === options.category);
  }
  if (options?.read !== undefined) {
    filtered = filtered.filter((n) => n.read === options.read);
  }
  return filtered
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, options?.limit ?? 100);
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (usePrismaStore) {
    return prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  return demoNotifications.filter((n) => n.userId === userId && !n.read).length;
}

export async function markAsRead(notificationId: string, userId: string): Promise<NotificationDTO> {
  if (usePrismaStore) {
    const notification = await prisma.notification.update({
      where: {
        id: notificationId,
        userId, // Ensure user can only mark their own notifications as read
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
    return mapNotification(notification);
  }

  const index = demoNotifications.findIndex((n) => n.id === notificationId && n.userId === userId);
  if (index === -1) {
    throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  }

  const now = new Date().toISOString();
  demoNotifications[index] = {
    ...demoNotifications[index],
    read: true,
    readAt: now,
  };
  return demoNotifications[index];
}

export async function markAllAsRead(userId: string): Promise<number> {
  if (usePrismaStore) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
    return result.count;
  }

  const count = demoNotifications.filter((n) => n.userId === userId && !n.read).length;
  const now = new Date().toISOString();
  demoNotifications.forEach((n) => {
    if (n.userId === userId && !n.read) {
      n.read = true;
      n.readAt = now;
    }
  });
  return count;
}

// Helper functions to create notifications for specific events
export async function notifyProposalAccepted(
  proposerId: string,
  gigTitle: string,
  amount: number
): Promise<void> {
  await createNotification(
    proposerId,
    'Proposal Accepted',
    `Your proposal for "${gigTitle}" has been accepted. Amount: ₦${amount.toLocaleString()}`,
    'GIG',
    { type: 'PROPOSAL_ACCEPTED', gigTitle, amount }
  );
}

export async function notifyProposalRejected(
  proposerId: string,
  gigTitle: string
): Promise<void> {
  await createNotification(
    proposerId,
    'Proposal Rejected',
    `Your proposal for "${gigTitle}" has been rejected.`,
    'GIG',
    { type: 'PROPOSAL_REJECTED', gigTitle }
  );
}

export async function notifyNewProposal(
  gigOwnerId: string,
  gigTitle: string,
  proposerName: string
): Promise<void> {
  await createNotification(
    gigOwnerId,
    'New Proposal Received',
    `${proposerName} submitted a proposal for "${gigTitle}"`,
    'GIG',
    { type: 'NEW_PROPOSAL', gigTitle, proposerName }
  );
}

export async function notifyOrderCompleted(
  sellerId: string,
  orderId: string,
  amount: number
): Promise<void> {
  await createNotification(
    sellerId,
    'Order Completed',
    `Order #${orderId} has been completed. ₦${amount.toLocaleString()} has been released to your wallet.`,
    'GIG',
    { type: 'ORDER_COMPLETED', orderId, amount }
  );
}

export async function notifyWalletTransaction(
  userId: string,
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  description: string
): Promise<void> {
  await createNotification(
    userId,
    type === 'CREDIT' ? 'Funds Added' : 'Funds Deducted',
    `${description}. Amount: ₦${amount.toLocaleString()}`,
    'FINANCE',
    { type: 'WALLET_TRANSACTION', transactionType: type, amount, description }
  );
}
