import { EmailStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export const emailMessageRepository = {
  findById(id: string) {
    return prisma.emailMessage.findUnique({
      where: { id },
      include: {
        campaign: true,
        sender: true,
        job: true,
      },
    });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.emailMessage.findUnique({
      where: { idempotencyKey },
    });
  },

  findScheduled(limit = 100) {
    return prisma.emailMessage.findMany({
      where: {
        status: EmailStatus.SCHEDULED,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      take: limit,
    });
  },

  findSent(limit = 100) {
    return prisma.emailMessage.findMany({
      where: {
        status: EmailStatus.SENT,
      },
      orderBy: {
        sentAt: 'desc',
      },
      take: limit,
    });
  },

  create(data: Prisma.EmailMessageCreateInput) {
    return prisma.emailMessage.create({
      data,
    });
  },

  updateStatus(id: string, status: EmailStatus, data?: Prisma.EmailMessageUpdateInput) {
    return prisma.emailMessage.update({
      where: { id },
      data: {
        ...data,
        status,
      },
    });
  },
};
