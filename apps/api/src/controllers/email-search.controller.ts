import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { emailSearchService } from '../services/search';

export const emailSearchQuerySchema = z.object({
  q: z.string().optional(),
  userId: z.string().optional(),
  campaignId: z.string().optional(),
  senderId: z.string().optional(),
  senderEmail: z.string().optional(),
  recipient: z.string().optional(),
  status: z
    .enum(['DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'])
    .optional(),
  dateField: z.enum(['createdAt', 'scheduledAt', 'sentAt']).default('sentAt'),
  from: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum([
      'sentAt:desc',
      'sentAt:asc',
      'createdAt:desc',
      'createdAt:asc',
      'scheduledAt:desc',
      'scheduledAt:asc',
    ])
    .default('sentAt:desc'),
});

export type EmailSearchQueryParams = z.infer<typeof emailSearchQuerySchema>;

export async function searchEmails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = emailSearchQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search query parameters',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
      return;
    }

    const result = await emailSearchService.search(parseResult.data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
