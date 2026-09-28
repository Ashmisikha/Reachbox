import { Request, Response, NextFunction } from 'express';
import {
  failureService,
  listFailuresQuerySchema,
  retrySelectedSchema,
} from '../services/failure.service';

export const failureController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listFailuresQuerySchema.parse(req.query);
      const result = await failureService.listFailures(req.user!.id, query);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async retrySingle(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await failureService.retrySingle(req.user!.id, req.params['id'] as string);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async retrySelected(req: Request, res: Response, next: NextFunction) {
    try {
      const body = retrySelectedSchema.parse(req.body);
      const result = await failureService.retrySelected(req.user!.id, body.messageIds);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async retryAll(req: Request, res: Response, next: NextFunction) {
    try {
      const campaignId = req.query.campaignId as string | undefined;
      const result = await failureService.retryAllEligible(req.user!.id, campaignId);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
};
