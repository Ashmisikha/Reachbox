import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
  deleteContacts,
  getContactTags,
  importContactsCsv,
} from '../services/contact.service';
import { AppError } from '../middleware/errorHandler';

export async function createContactHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const contact = await createContact(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
}

export async function listContactsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const result = await getContacts(req.user.id, req.query);
    res.status(200).json({
      success: true,
      data: result.contacts,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getContactHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      throw new AppError('Contact ID is required', 400, 'VALIDATION_ERROR');
    }

    const contact = await getContactById(req.user.id, id);
    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateContactHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      throw new AppError('Contact ID is required', 400, 'VALIDATION_ERROR');
    }

    const contact = await updateContact(req.user.id, id, req.body);
    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteContactHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      throw new AppError('Contact ID is required', 400, 'VALIDATION_ERROR');
    }

    const result = await deleteContact(req.user.id, id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkDeleteContactsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const schema = z.object({
      ids: z.array(z.string().uuid()).min(1, 'At least one contact ID is required'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid contact IDs array', 400, 'VALIDATION_ERROR');
    }

    const result = await deleteContacts(req.user.id, parsed.data.ids);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getContactTagsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const tags = await getContactTags(req.user.id);
    res.status(200).json({
      success: true,
      data: tags,
    });
  } catch (error) {
    next(error);
  }
}

export async function importContactsCsvHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const schema = z.object({
      csv: z.string({ required_error: 'CSV content is required' }),
      defaultTags: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('CSV content must be a valid string', 400, 'VALIDATION_ERROR');
    }

    const result = await importContactsCsv(req.user.id, parsed.data.csv, {
      defaultTags: parsed.data.defaultTags,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
