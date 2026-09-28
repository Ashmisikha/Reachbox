import { Metadata } from 'next';
import { LegalPageShell } from '../../components/legal/LegalPageShell';
import { SupportContent } from '../../components/legal/SupportContent';

export const metadata: Metadata = {
  title: 'Help & Support | ReachInbox Email Job Scheduler',
  description: 'ReachInbox Help Center, FAQs, BullMQ troubleshooting, and technical support inquiries.',
};

export default function SupportPage() {
  return (
    <LegalPageShell currentTab="support">
      <SupportContent />
    </LegalPageShell>
  );
}
