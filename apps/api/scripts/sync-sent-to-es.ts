import prisma from '../src/lib/prisma';
import { emailIndexService, EmailIndexService } from '../src/services/search';

async function main() {
  const sentMessages = await prisma.emailMessage.findMany({
    where: { status: 'SENT' },
    include: { sender: true, campaign: true },
  });

  for (const m of sentMessages) {
    const doc = EmailIndexService.transformToDocument(m);
    await emailIndexService.indexEmail(doc, { refresh: true });
    console.log(`Indexed message ${m.id} to ${m.recipient}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
