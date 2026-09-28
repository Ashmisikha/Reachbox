import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export interface ListSuppressionsParams {
  userId: string;
  search?: string;
  skip?: number;
  take?: number;
}

export const suppressionRepository = {
  findById(id: string, userId: string) {
    return prisma.suppression.findFirst({
      where: { id, userId },
    });
  },

  findByEmail(userId: string, email: string) {
    return prisma.suppression.findUnique({
      where: {
        userId_email: {
          userId,
          email: email.toLowerCase().trim(),
        },
      },
    });
  },

  async list(params: ListSuppressionsParams) {
    const where: Prisma.SuppressionWhereInput = {
      userId: params.userId,
    };

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [suppressions, total] = await Promise.all([
      prisma.suppression.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.suppression.count({ where }),
    ]);

    return { suppressions, total };
  },

  create(data: { userId: string; email: string; reason?: string }) {
    const normalizedEmail = data.email.toLowerCase().trim();
    return prisma.suppression.upsert({
      where: {
        userId_email: {
          userId: data.userId,
          email: normalizedEmail,
        },
      },
      create: {
        userId: data.userId,
        email: normalizedEmail,
        reason: data.reason || 'Manually added',
      },
      update: {
        reason: data.reason || 'Manually added',
      },
    });
  },

  delete(id: string, userId: string) {
    return prisma.suppression.deleteMany({
      where: { id, userId },
    });
  },

  deleteByEmail(userId: string, email: string) {
    return prisma.suppression.deleteMany({
      where: {
        userId,
        email: email.toLowerCase().trim(),
      },
    });
  },
};
