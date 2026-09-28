import { ContactStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export interface ListContactsParams {
  userId: string;
  search?: string;
  tag?: string;
  status?: ContactStatus;
  skip?: number;
  take?: number;
}

export const contactRepository = {
  findById(id: string, userId: string) {
    return prisma.contact.findFirst({
      where: { id, userId },
    });
  },

  findByEmail(userId: string, email: string) {
    return prisma.contact.findUnique({
      where: {
        userId_email: {
          userId,
          email,
        },
      },
    });
  },

  findManyByEmails(userId: string, emails: string[]) {
    return prisma.contact.findMany({
      where: {
        userId,
        email: { in: emails },
      },
    });
  },

  async list(params: ListContactsParams) {
    const where: Prisma.ContactWhereInput = {
      userId: params.userId,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.tag) {
      where.tags = { has: params.tag };
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
        { jobTitle: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
      }),
      prisma.contact.count({ where }),
    ]);

    return { contacts, total };
  },

  create(data: Prisma.ContactCreateInput) {
    return prisma.contact.create({
      data,
    });
  },

  createMany(data: Prisma.ContactCreateManyInput[]) {
    return prisma.contact.createMany({
      data,
      skipDuplicates: true,
    });
  },

  update(id: string, userId: string, data: Prisma.ContactUpdateInput) {
    return prisma.contact.updateMany({
      where: { id, userId },
      data,
    });
  },

  delete(id: string, userId: string) {
    return prisma.contact.deleteMany({
      where: { id, userId },
    });
  },

  deleteMany(ids: string[], userId: string) {
    return prisma.contact.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });
  },

  async getAllTags(userId: string): Promise<string[]> {
    const contacts = await prisma.contact.findMany({
      where: { userId },
      select: { tags: true },
    });

    const set = new Set<string>();
    for (const c of contacts) {
      for (const t of c.tags) {
        if (t) set.add(t);
      }
    }
    return Array.from(set).sort();
  },
};
