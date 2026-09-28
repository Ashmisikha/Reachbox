import { Prisma, SenderStatus } from '@prisma/client';
import prisma from '../lib/prisma';

export const senderRepository = {
  findById(id: string) {
    return prisma.senderAccount.findUnique({
      where: { id },
    });
  },

  findByUserAndEmail(userId: string, email: string) {
    return prisma.senderAccount.findUnique({
      where: {
        userId_email: {
          userId,
          email: email.toLowerCase(),
        },
      },
    });
  },

  findByUser(userId: string) {
    return prisma.senderAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  },

  create(data: Prisma.SenderAccountCreateInput) {
    return prisma.senderAccount.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
    });
  },

  updateStatus(id: string, status: SenderStatus) {
    return prisma.senderAccount.update({
      where: { id },
      data: { status },
    });
  },
};
