import { Metadata } from 'next';
import { LegalPageShell } from '../../components/legal/LegalPageShell';
import { TermsContent } from '../../components/legal/TermsContent';

export const metadata: Metadata = {
  title: 'Terms of Service | ReachInbox Email Job Scheduler',
  description: 'Terms of service, acceptable use policies, and worker execution guidelines for ReachInbox.',
};

export default function TermsPage() {
  return (
    <LegalPageShell currentTab="terms">
      <TermsContent />
    </LegalPageShell>
  );
}
