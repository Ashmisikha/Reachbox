import { z } from 'zod';
import { templateRepository } from '../repositories/template.repository';
import { contactRepository } from '../repositories/contact.repository';
import { PersonalizationService } from './personalization.service';
import { AppError } from '../middleware/errorHandler';

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(150),
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  body: z.string().trim().min(1, 'Email body is required'),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  subject: z.string().trim().min(1).max(300).optional(),
  body: z.string().trim().min(1).optional(),
});

export const listTemplatesQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const previewTemplateSchema = z.object({
  subject: z.string().default(''),
  body: z.string().default(''),
  contactId: z.string().uuid().optional(),
  sampleData: z
    .object({
      firstName: z.string().optional().nullable(),
      lastName: z.string().optional().nullable(),
      company: z.string().optional().nullable(),
      jobTitle: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
    })
    .optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const templateService = {
  async listTemplates(userId: string, query: z.infer<typeof listTemplatesQuerySchema>) {
    const skip = (query.page - 1) * query.limit;
    const { templates, total } = await templateRepository.list({
      userId,
      search: query.search,
      skip,
      take: query.limit,
    });

    return {
      templates,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  },

  async getTemplateById(userId: string, id: string) {
    const template = await templateRepository.findById(id, userId);
    if (!template) {
      throw new AppError('Email template not found', 404, 'TEMPLATE_NOT_FOUND');
    }
    return template;
  },

  async createTemplate(userId: string, input: CreateTemplateInput) {
    return templateRepository.create({
      userId,
      name: input.name,
      subject: input.subject,
      body: input.body,
    });
  },

  async updateTemplate(userId: string, id: string, input: UpdateTemplateInput) {
    await this.getTemplateById(userId, id); // Verify ownership
    await templateRepository.update(id, userId, input);
    return this.getTemplateById(userId, id);
  },

  async deleteTemplate(userId: string, id: string) {
    await this.getTemplateById(userId, id); // Verify ownership
    await templateRepository.delete(id, userId);
    return { success: true };
  },

  async duplicateTemplate(userId: string, id: string) {
    const original = await this.getTemplateById(userId, id);
    const duplicated = await templateRepository.create({
      userId,
      name: `${original.name} (Copy)`,
      subject: original.subject,
      body: original.body,
    });
    return duplicated;
  },

  async previewTemplate(userId: string, input: z.infer<typeof previewTemplateSchema>) {
    let context: Record<string, unknown> = input.sampleData || {};

    if (input.contactId) {
      const contact = await contactRepository.findById(input.contactId, userId);
      if (contact) {
        context = {
          firstName: contact.firstName,
          lastName: contact.lastName,
          company: contact.company,
          jobTitle: contact.jobTitle,
          email: contact.email,
        };
      }
    }

    const preview = PersonalizationService.renderEmail(input.subject, input.body, context);

    return {
      previewSubject: preview.subject,
      previewBody: preview.body,
      usedVariables: preview.usedVariables,
      missingVariables: preview.missingVariables,
      context,
    };
  },
};
