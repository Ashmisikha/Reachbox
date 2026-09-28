import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export interface ListTemplatesParams {
  userId: string;
  search?: string;
  skip?: number;
  take?: number;
}

export const templateRepository = {
  findById(id: string, userId: string) {
    return prisma.emailTemplate.findFirst({
      where: { id, userId },
    });
  },

  async list(params: ListTemplatesParams) {
    const where: Prisma.EmailTemplateWhereInput = {
      userId: params.userId,
    };

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.emailTemplate.count({ where }),
    ]);

    return { templates, total };
  },

  create(data: { userId: string; name: string; subject: string; body: string }) {
    return prisma.emailTemplate.create({
      data,
    });
  },

  update(id: string, userId: string, data: { name?: string; subject?: string; body?: string }) {
    return prisma.emailTemplate.updateMany({
      where: { id, userId },
      data,
    });
  },

  delete(id: string, userId: string) {
    return prisma.emailTemplate.deleteMany({
      where: { id, userId },
    });
  },
};
