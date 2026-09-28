import { Metadata } from 'next';
import { LegalPageShell } from '../../components/legal/LegalPageShell';
import { PrivacyContent } from '../../components/legal/PrivacyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy | ReachInbox Email Job Scheduler',
  description: 'Learn how ReachInbox protects your data, credentials, and ensures Google API Limited Use compliance.',
};

export default function PrivacyPage() {
  return (
    <LegalPageShell currentTab="privacy">
      <PrivacyContent />
    </LegalPageShell>
  );
}
