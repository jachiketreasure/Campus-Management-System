import { Prisma, prisma } from '@cms/database';
import { randomUUID } from 'crypto';

const usePrismaStore = process.env.NEXTAUTH_USE_PRISMA === 'true';

export const gigStatusValues = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;

export type GigStatus = (typeof gigStatusValues)[number];

export type GigFilters = {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: GigStatus;
  ownerId?: string;
};

export type GigCreateInput = {
  title: string;
  description: string;
  category: string;
  price: number;
  currency?: string;
  deliveryTimeDays: number;
  attachments?: string[];
  tags?: string[];
  status?: GigStatus;
};

export type GigUpdateInput = Partial<GigCreateInput>;

export type GigDTO = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  deliveryTimeDays: number;
  attachments: string[];
  tags: string[];
  status: GigStatus;
  createdAt: string;
  updatedAt: string;
};

const demoGigs: GigDTO[] = [
  {
    id: 'demo-gig-1',
    ownerId: 'demo-student',
    title: 'Campus Portal UI Refresh',
    description:
      'Design a responsive, accessible UI refresh for the campus management portal with modern UI library recommendations.',
    category: 'Design',
    price: 45000,
    currency: 'NGN',
    deliveryTimeDays: 7,
    attachments: [],
    tags: ['design', 'ui', 'figma'],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()
  },
  {
    id: 'demo-gig-2',
    ownerId: 'demo-student',
    title: 'Proctoring Report Automation',
    description:
      'Build a script to summarize exam malpractice events into a PDF report using provided API endpoints.',
    category: 'Automation',
    price: 60000,
    currency: 'NGN',
    deliveryTimeDays: 5,
    attachments: [],
    tags: ['automation', 'python', 'reports'],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  }
];

type GigRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  price: Prisma.Decimal | number;
  currency: string;
  deliveryTimeDays: number;
  attachments: string[] | null;
  tags: string[] | null;
  status: GigStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const toDTO = (gig: GigRecord): GigDTO => ({
  id: gig.id,
  ownerId: gig.ownerId,
  title: gig.title,
  description: gig.description,
  category: gig.category,
  price: Number(gig.price),
  currency: gig.currency,
  deliveryTimeDays: gig.deliveryTimeDays,
  attachments: gig.attachments ?? [],
  tags: gig.tags ?? [],
  status: gig.status,
  createdAt: gig.createdAt instanceof Date ? gig.createdAt.toISOString() : gig.createdAt,
  updatedAt: gig.updatedAt instanceof Date ? gig.updatedAt.toISOString() : gig.updatedAt
});

export async function listGigs(filters: GigFilters = {}): Promise<GigDTO[]> {
  if (usePrismaStore) {
    const where: Prisma.GigWhereInput = {
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.minPrice || filters.maxPrice
        ? {
            price: {
              ...(typeof filters.minPrice === 'number' ? { gte: new Prisma.Decimal(filters.minPrice) } : {}),
              ...(typeof filters.maxPrice === 'number' ? { lte: new Prisma.Decimal(filters.maxPrice) } : {})
            }
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
              { tags: { has: filters.search } }
            ]
          }
        : {})
    };

    const gigs = await prisma.gig.findMany({
      where,
      select: {
        id: true,
        ownerId: true,
        title: true,
        description: true,
        category: true,
        price: true,
        currency: true,
        deliveryTimeDays: true,
        attachments: true,
        tags: true,
        status: true,
        ratingAvg: true,
        reviewCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit results for performance
    });
    return gigs.map(toDTO);
  }

  return demoGigs
    .filter((gig) => {
      if (filters.category && gig.category !== filters.category) return false;
      if (filters.status && gig.status !== filters.status) return false;
      if (filters.ownerId && gig.ownerId !== filters.ownerId) return false;
      if (typeof filters.minPrice === 'number' && gig.price < filters.minPrice) return false;
      if (typeof filters.maxPrice === 'number' && gig.price > filters.maxPrice) return false;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matches =
          gig.title.toLowerCase().includes(query) ||
          gig.description.toLowerCase().includes(query) ||
          gig.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matches) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getGigById(gigId: string): Promise<GigDTO | null> {
  if (usePrismaStore) {
    const gig = await prisma.gig.findUnique({ where: { id: gigId } });
    return gig ? toDTO(gig) : null;
  }

  return demoGigs.find((gig) => gig.id === gigId) ?? null;
}

export async function createGig(ownerId: string, input: GigCreateInput): Promise<GigDTO> {
  const payload = {
    title: input.title,
    description: input.description,
    category: input.category,
    price: input.price,
    currency: input.currency ?? 'NGN',
    deliveryTimeDays: input.deliveryTimeDays,
    attachments: input.attachments ?? [],
    tags: input.tags ?? [],
    status: input.status ?? 'ACTIVE'
  };

  if (usePrismaStore) {
    const created = await prisma.gig.create({
      data: {
        ...payload,
        price: new Prisma.Decimal(payload.price),
        ownerId
      }
    });
    return toDTO(created);
  }

  const now = new Date().toISOString();
  const newGig: GigDTO = {
    id: randomUUID(),
    ownerId,
    createdAt: now,
    updatedAt: now,
    ...payload
  };
  demoGigs.push(newGig);
  return newGig;
}

export async function updateGig(
  gigId: string,
  ownerId: string,
  roles: string[],
  input: GigUpdateInput
): Promise<GigDTO | null> {
  if (usePrismaStore) {
    const existing = await prisma.gig.findUnique({ where: { id: gigId } });
    if (!existing) {
      return null;
    }
    if (existing.ownerId !== ownerId && !roles.includes('ADMIN')) {
      const error = new Error('Forbidden');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    const updated = await prisma.gig.update({
      where: { id: gigId },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(typeof input.price === 'number' ? { price: new Prisma.Decimal(input.price) } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(typeof input.deliveryTimeDays === 'number' ? { deliveryTimeDays: input.deliveryTimeDays } : {}),
        ...(input.attachments ? { attachments: input.attachments } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.status ? { status: input.status } : {}),
        updatedAt: new Date()
      }
    });

    return toDTO(updated);
  }

  const gigIndex = demoGigs.findIndex((gig) => gig.id === gigId);
  if (gigIndex === -1) {
    return null;
  }

  const existing = demoGigs[gigIndex];
  if (existing.ownerId !== ownerId && !roles.includes('ADMIN')) {
    const error = new Error('Forbidden');
    Object.assign(error, { statusCode: 403 });
    throw error;
  }

  const updated: GigDTO = {
    ...existing,
    ...(input.title ? { title: input.title } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(typeof input.price === 'number' ? { price: input.price } : {}),
    ...(input.currency ? { currency: input.currency } : {}),
    ...(typeof input.deliveryTimeDays === 'number' ? { deliveryTimeDays: input.deliveryTimeDays } : {}),
    ...(input.attachments ? { attachments: input.attachments } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.status ? { status: input.status } : {}),
    updatedAt: new Date().toISOString()
  };

  demoGigs[gigIndex] = updated;
  return updated;
}

