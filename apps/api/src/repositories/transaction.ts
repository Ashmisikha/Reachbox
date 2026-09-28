import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: Parameters<typeof prisma.$transaction>[1]
): Promise<T> {
  return prisma.$transaction(callback, options);
}
