import { z } from 'zod';
import { ContactStatus } from '@prisma/client';
import { contactRepository } from '../repositories/contact.repository';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../lib/logger';
import { ContactImportSummary } from '@reachinbox/shared';

// ─── Email Validation Helper ──────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const createContactSchema = z.object({
  email: z.string().trim().toLowerCase().refine(isValidEmail, { message: 'Invalid email address' }),
  firstName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().max(100).optional().nullable(),
  company: z.string().trim().max(150).optional().nullable(),
  jobTitle: z.string().trim().max(150).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).optional().default([]),
  status: z.nativeEnum(ContactStatus).optional().default(ContactStatus.ACTIVE),
});

export const updateContactSchema = z.object({
  firstName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().max(100).optional().nullable(),
  company: z.string().trim().max(150).optional().nullable(),
  jobTitle: z.string().trim().max(150).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
  status: z.nativeEnum(ContactStatus).optional(),
});

export const listContactsQuerySchema = z.object({
  search: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  status: z.nativeEnum(ContactStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ─── CSV Parser Helper ────────────────────────────────────────────────────────

export interface ParsedCsvRow {
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Robust CSV parser that handles quotes, commas inside fields, CRLF, and escapes.
 */
export function parseCsvContent(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === ';') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        // Handle CRLF
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push remainder
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Maps CSV header row to standard fields.
 */
function normalizeHeaderName(header: string): string {
  const h = header.toLowerCase().replace(/[\s_-]+/g, '');
  if (h === 'email' || h === 'emailaddress') return 'email';
  if (h === 'firstname' || h === 'first') return 'firstName';
  if (h === 'lastname' || h === 'last') return 'lastName';
  if (h === 'name' || h === 'fullname') return 'fullName';
  if (h === 'company' || h === 'organization' || h === 'org') return 'company';
  if (h === 'jobtitle' || h === 'title' || h === 'role' || h === 'position') return 'jobTitle';
  if (h === 'tags' || h === 'tag' || h === 'labels') return 'tags';
  return h;
}

// ─── Contact Service Functions ────────────────────────────────────────────────

export async function createContact(userId: string, input: unknown) {
  const parsed = createContactSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('Invalid contact data', 400, 'VALIDATION_ERROR', {
      fields: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  const { email, firstName, lastName, company, jobTitle, tags, status } = parsed.data;

  // Check duplicate
  const existing = await contactRepository.findByEmail(userId, email);
  if (existing) {
    throw new AppError(`Contact with email '${email}' already exists`, 409, 'CONTACT_ALREADY_EXISTS');
  }

  const contact = await contactRepository.create({
    user: { connect: { id: userId } },
    email,
    firstName: firstName || null,
    lastName: lastName || null,
    company: company || null,
    jobTitle: jobTitle || null,
    tags: tags || [],
    status: status || ContactStatus.ACTIVE,
  });

  logger.info('Contact created', { userId, contactId: contact.id, email });
  return contact;
}

export async function getContacts(userId: string, query: unknown) {
  const parsed = listContactsQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError('Invalid contact query', 400, 'VALIDATION_ERROR');
  }

  const { search, tag, status, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  const { contacts, total } = await contactRepository.list({
    userId,
    search,
    tag,
    status,
    skip,
    take: limit,
  });

  return {
    contacts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getContactById(userId: string, id: string) {
  const contact = await contactRepository.findById(id, userId);
  if (!contact) {
    throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
  }
  return contact;
}

export async function updateContact(userId: string, id: string, input: unknown) {
  const contact = await contactRepository.findById(id, userId);
  if (!contact) {
    throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
  }

  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('Invalid contact update data', 400, 'VALIDATION_ERROR', {
      fields: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName;
  if (parsed.data.company !== undefined) updateData.company = parsed.data.company;
  if (parsed.data.jobTitle !== undefined) updateData.jobTitle = parsed.data.jobTitle;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  await contactRepository.update(id, userId, updateData);

  return contactRepository.findById(id, userId);
}

export async function deleteContact(userId: string, id: string) {
  const contact = await contactRepository.findById(id, userId);
  if (!contact) {
    throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
  }

  await contactRepository.delete(id, userId);
  logger.info('Contact deleted', { userId, contactId: id });
  return { id, deleted: true };
}

export async function deleteContacts(userId: string, ids: string[]) {
  if (!ids || ids.length === 0) {
    return { count: 0 };
  }
  const result = await contactRepository.deleteMany(ids, userId);
  logger.info('Contacts bulk deleted', { userId, count: result.count });
  return { count: result.count };
}

export async function getContactTags(userId: string): Promise<string[]> {
  return contactRepository.getAllTags(userId);
}

/**
 * Bulk import contacts from raw CSV string or pre-parsed rows.
 * Enforces ownership, duplicate removal, email validation, and returns detailed summary.
 */
export async function importContactsCsv(
  userId: string,
  csvContent: string,
  options?: { defaultTags?: string[] }
): Promise<ContactImportSummary & { contacts: unknown[] }> {
  const defaultTags = options?.defaultTags || [];

  if (!csvContent || typeof csvContent !== 'string' || !csvContent.trim()) {
    return {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      invalid: 0,
      totalRows: 0,
      contacts: [],
    };
  }

  const rawRows = parseCsvContent(csvContent);
  if (rawRows.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      invalid: 0,
      totalRows: 0,
      contacts: [],
    };
  }

  // Check headers in first row
  const firstRow = rawRows[0];
  if (!firstRow || firstRow.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      invalid: 0,
      totalRows: 0,
      contacts: [],
    };
  }

  const headerMap: Record<string, number> = {};
  let hasHeader = false;

  for (let colIdx = 0; colIdx < firstRow.length; colIdx++) {
    const rawCol = (firstRow[colIdx] || '').trim();
    const normalized = normalizeHeaderName(rawCol);
    if (['email', 'firstName', 'lastName', 'fullName', 'company', 'jobTitle', 'tags'].includes(normalized)) {
      headerMap[normalized] = colIdx;
      hasHeader = true;
    }
  }

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const totalRows = dataRows.length;

  let invalid = 0;
  let duplicates = 0;
  let skipped = 0;

  // Track seen in current import
  const seenEmailsInFile = new Set<string>();
  const rowsToInsert: {
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    jobTitle: string | null;
    tags: string[];
    status: ContactStatus;
  }[] = [];

  for (const row of dataRows) {
    // If empty row
    if (!row || row.every((c) => !c.trim())) {
      skipped++;
      continue;
    }

    let emailVal = '';
    let firstVal: string | null = null;
    let lastVal: string | null = null;
    let compVal: string | null = null;
    let jobVal: string | null = null;
    let rowTags: string[] = [...defaultTags];

    if (hasHeader && headerMap['email'] !== undefined) {
      emailVal = (row[headerMap['email']] || '').trim().toLowerCase();

      if (headerMap['firstName'] !== undefined) {
        firstVal = (row[headerMap['firstName']] || '').trim() || null;
      }
      if (headerMap['lastName'] !== undefined) {
        lastVal = (row[headerMap['lastName']] || '').trim() || null;
      }
      if (headerMap['fullName'] !== undefined && !firstVal) {
        const full = (row[headerMap['fullName']] || '').trim();
        if (full) {
          const parts = full.split(/\s+/);
          firstVal = parts[0] || null;
          lastVal = parts.slice(1).join(' ') || null;
        }
      }
      if (headerMap['company'] !== undefined) {
        compVal = (row[headerMap['company']] || '').trim() || null;
      }
      if (headerMap['jobTitle'] !== undefined) {
        jobVal = (row[headerMap['jobTitle']] || '').trim() || null;
      }
      if (headerMap['tags'] !== undefined) {
        const rawT = (row[headerMap['tags']] || '').trim();
        if (rawT) {
          const splitTags = rawT.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
          rowTags.push(...splitTags);
        }
      }
    } else {
      // No standard header found: assume first column is email, 2nd firstName, 3rd lastName/company
      emailVal = (row[0] || '').trim().toLowerCase();
      if (row.length > 1) firstVal = (row[1] || '').trim() || null;
      if (row.length > 2) lastVal = (row[2] || '').trim() || null;
      if (row.length > 3) compVal = (row[3] || '').trim() || null;
      if (row.length > 4) jobVal = (row[4] || '').trim() || null;
    }

    // Validate email
    if (!emailVal || !isValidEmail(emailVal)) {
      invalid++;
      continue;
    }

    // Check duplicate in current file
    if (seenEmailsInFile.has(emailVal)) {
      duplicates++;
      continue;
    }
    seenEmailsInFile.add(emailVal);

    // Deduplicate tags
    const cleanTags = Array.from(new Set(rowTags));

    rowsToInsert.push({
      userId,
      email: emailVal,
      firstName: firstVal,
      lastName: lastVal,
      company: compVal,
      jobTitle: jobVal,
      tags: cleanTags,
      status: ContactStatus.ACTIVE,
    });
  }

  if (rowsToInsert.length === 0) {
    return {
      imported: 0,
      skipped,
      duplicates,
      invalid,
      totalRows,
      contacts: [],
    };
  }

  // Check duplicates against existing database records for this user
  const emailsToCheck = rowsToInsert.map((r) => r.email);
  const existingContacts = await contactRepository.findManyByEmails(userId, emailsToCheck);
  const existingEmailSet = new Set(existingContacts.map((c) => c.email.toLowerCase()));

  const finalRowsToCreate = rowsToInsert.filter((r) => {
    if (existingEmailSet.has(r.email)) {
      duplicates++;
      return false;
    }
    return true;
  });

  if (finalRowsToCreate.length > 0) {
    await contactRepository.createMany(finalRowsToCreate);
  }

  // Fetch newly imported contacts to return
  const newlyCreated = await contactRepository.findManyByEmails(
    userId,
    finalRowsToCreate.map((r) => r.email)
  );

  logger.info('Contacts imported', {
    userId,
    imported: finalRowsToCreate.length,
    duplicates,
    invalid,
    skipped,
    totalRows,
  });

  return {
    imported: finalRowsToCreate.length,
    skipped,
    duplicates,
    invalid,
    totalRows,
    contacts: newlyCreated,
  };
}
