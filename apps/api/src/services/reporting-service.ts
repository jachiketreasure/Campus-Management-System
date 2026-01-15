import { Prisma, prisma } from '@cms/database';
import { listTransactions } from './wallet-service';
import { listGigs } from './gig-service';
import { listOrdersForUser } from './proposal-service';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export async function generateTransactionsReport(userId: string): Promise<string> {
  const transactions = await listTransactions(userId);
  
  // CSV header
  const headers = ['ID', 'Date', 'Type', 'Amount (₦)', 'Status', 'Reference', 'Order ID'];
  const rows = transactions.map((tx) => [
    tx.id,
    new Date(tx.createdAt).toISOString(),
    tx.type,
    tx.amount.toFixed(2),
    tx.status,
    tx.reference,
    tx.orderId || '',
  ]);

  return generateCSV(headers, rows);
}

export async function generateGigsReport(ownerId?: string): Promise<string> {
  const gigs = await listGigs({ ownerId });
  
  // CSV header
  const headers = ['ID', 'Title', 'Category', 'Price (₦)', 'Delivery Days', 'Status', 'Created At'];
  const rows = gigs.map((gig) => [
    gig.id,
    gig.title,
    gig.category,
    gig.price.toFixed(2),
    gig.deliveryTimeDays.toString(),
    gig.status,
    new Date(gig.createdAt).toISOString(),
  ]);

  return generateCSV(headers, rows);
}

export async function generateOrdersReport(userId: string): Promise<string> {
  const orders = await listOrdersForUser(userId);
  
  // CSV header
  const headers = ['ID', 'Gig ID', 'Buyer ID', 'Seller ID', 'Amount (₦)', 'Status', 'Escrow Released', 'Created At'];
  const rows = orders.map((order) => [
    order.id,
    order.gigId,
    order.buyerId,
    order.sellerId,
    order.amount.toFixed(2),
    order.status,
    order.escrowReleased ? 'Yes' : 'No',
    new Date(order.createdAt).toISOString(),
  ]);

  return generateCSV(headers, rows);
}

function generateCSV(headers: string[], rows: string[][]): string {
  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ];

  return csvRows.join('\n');
}
