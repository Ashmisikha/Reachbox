import { Request, Response, NextFunction } from 'express';
import {
  templateService,
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesQuerySchema,
  previewTemplateSchema,
} from '../services/template.service';

export const templateController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listTemplatesQuerySchema.parse(req.query);
      const result = await templateService.listTemplates(req.user!.id, query);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await templateService.getTemplateById(req.user!.id, req.params['id'] as string);
      res.json({
        success: true,
        data: template,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createTemplateSchema.parse(req.body);
      const template = await templateService.createTemplate(req.user!.id, body);
      res.status(201).json({
        success: true,
        data: template,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateTemplateSchema.parse(req.body);
      const template = await templateService.updateTemplate(req.user!.id, req.params['id'] as string, body);
      res.json({
        success: true,
        data: template,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await templateService.deleteTemplate(req.user!.id, req.params['id'] as string);
      res.json({
        success: true,
        data: { message: 'Template deleted successfully' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await templateService.duplicateTemplate(req.user!.id, req.params['id'] as string);
      res.status(201).json({
        success: true,
        data: template,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const body = previewTemplateSchema.parse(req.body);
      const result = await templateService.previewTemplate(req.user!.id, body);
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
