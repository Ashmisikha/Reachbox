import { z } from 'zod';
import { suppressionRepository } from '../repositories/suppression.repository';
import { AppError } from '../middleware/errorHandler';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createSuppressionSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => val.length <= 254 && EMAIL_REGEX.test(val), {
      message: 'Invalid email address',
    }),
  reason: z.string().trim().max(255).optional(),
});

export const listSuppressionsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const suppressionService = {
  async listSuppressions(userId: string, query: z.infer<typeof listSuppressionsQuerySchema>) {
    const skip = (query.page - 1) * query.limit;
    const { suppressions, total } = await suppressionRepository.list({
      userId,
      search: query.search,
      skip,
      take: query.limit,
    });

    return {
      suppressions,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  },

  async addSuppression(userId: string, input: z.infer<typeof createSuppressionSchema>) {
    return suppressionRepository.create({
      userId,
      email: input.email,
      reason: input.reason,
    });
  },

  async removeSuppression(userId: string, id: string) {
    const existing = await suppressionRepository.findById(id, userId);
    if (!existing) {
      throw new AppError('Suppression entry not found', 404, 'SUPPRESSION_NOT_FOUND');
    }
    await suppressionRepository.delete(id, userId);
    return { success: true };
  },

  async removeSuppressionByEmail(userId: string, email: string) {
    await suppressionRepository.deleteByEmail(userId, email);
    return { success: true };
  },

  async isSuppressed(userId: string, email: string): Promise<boolean> {
    const entry = await suppressionRepository.findByEmail(userId, email);
    return !!entry;
  },
};
