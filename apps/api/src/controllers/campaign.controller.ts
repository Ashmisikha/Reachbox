import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  getScheduledEmails,
  getSentEmails,
  getDashboardStats,
} from '../services/campaign.service';
import { senderRepository } from '../repositories/sender.repository';
import { AppError } from '../middleware/errorHandler';

// ─── Campaign CRUD ─────────────────────────────────────────────────────────────

export async function createCampaignHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const result = await createCampaign(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listCampaignsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const pageSchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    });

    const { page, pageSize } = pageSchema.parse(req.query);
    const result = await getCampaigns(req.user.id, page, pageSize);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCampaignHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const campaign = await getCampaignById(req.params['id'] as string, req.user.id);
    res.status(200).json({ campaign });
  } catch (error) {
    next(error);
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export async function dashboardStatsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const stats = await getDashboardStats(req.user.id);
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
}

// ─── Email views ───────────────────────────────────────────────────────────────

export async function scheduledEmailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const pageSchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    });

    const { page, pageSize } = pageSchema.parse(req.query);
    const result = await getScheduledEmails(req.user.id, page, pageSize);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function sentEmailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const pageSchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    });

    const { page, pageSize } = pageSchema.parse(req.query);
    const result = await getSentEmails(req.user.id, page, pageSize);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// ─── Sender listing ────────────────────────────────────────────────────────────

export async function listSendersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const senders = await senderRepository.findByUser(req.user.id);
    res.status(200).json({
      senders: senders.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createSenderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const schema = z.object({
      email: z.string().email('Valid email is required'),
      name: z.string().min(1).max(100).optional(),
    });

    const { email, name } = schema.parse(req.body);

    const existing = await senderRepository.findByUserAndEmail(req.user.id, email);
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        const updated = await senderRepository.updateStatus(existing.id, 'ACTIVE');
        res.status(200).json({ sender: updated });
        return;
      }
      res.status(200).json({ sender: existing });
      return;
    }

    const sender = await senderRepository.create({
      user: { connect: { id: req.user.id } },
      email,
      name: name ?? email.split('@')[0],
      status: 'ACTIVE',
    });

    res.status(201).json({ sender });
  } catch (error) {
    next(error);
  }
}

