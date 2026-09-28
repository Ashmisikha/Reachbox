import { Request, Response, NextFunction } from 'express';
import {
  suppressionService,
  createSuppressionSchema,
  listSuppressionsQuerySchema,
} from '../services/suppression.service';

export const suppressionController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listSuppressionsQuerySchema.parse(req.query);
      const result = await suppressionService.listSuppressions(req.user!.id, query);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createSuppressionSchema.parse(req.body);
      const suppression = await suppressionService.addSuppression(req.user!.id, body);
      res.status(201).json({
        success: true,
        data: suppression,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await suppressionService.removeSuppression(req.user!.id, req.params['id'] as string);
      res.json({
        success: true,
        data: { message: 'Suppression removed successfully' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteByEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.params['email'] as string;
      await suppressionService.removeSuppressionByEmail(req.user!.id, email);
      res.json({
        success: true,
        data: { message: 'Suppression removed successfully' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
};
