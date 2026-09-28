import { JobStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export const emailJobRepository = {
  findByEmailMessageId(emailMessageId: string) {
    return prisma.emailJob.findUnique({
      where: { emailMessageId },
    });
  },

  findByBullmqJobId(bullmqJobId: string) {
    return prisma.emailJob.findUnique({
      where: { bullmqJobId },
    });
  },

  create(data: Prisma.EmailJobCreateInput) {
    return prisma.emailJob.create({
      data,
    });
  },

  updateStatus(id: string, status: JobStatus, data?: Prisma.EmailJobUpdateInput) {
    return prisma.emailJob.update({
      where: { id },
      data: {
        ...data,
        status,
      },
    });
  },
};
