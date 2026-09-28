import { CampaignStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export const campaignRepository = {
  findById(id: string) {
    return prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        sender: true,
        messages: true,
      },
    });
  },

  findByUser(userId: string) {
    return prisma.emailCampaign.findMany({
      where: { userId },
      include: {
        sender: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  create(data: Prisma.EmailCampaignCreateInput) {
    return prisma.emailCampaign.create({
      data,
    });
  },

  updateStatus(id: string, status: CampaignStatus) {
    return prisma.emailCampaign.update({
      where: { id },
      data: { status },
    });
  },
};
