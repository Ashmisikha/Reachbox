'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useSenders } from '../../../hooks/useCampaigns';
import { campaignService, senderService } from '../../../services/campaign.service';
import { Card, Spinner, StatusBadge, EmptyState } from '../../../components/ui';
import {
  UserCheck,
  UploadCloud,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Sender', icon: UserCheck },
  { id: 2, label: 'Recipients', icon: UploadCloud },
  { id: 3, label: 'Content', icon: FileText },
  { id: 4, label: 'Schedule', icon: Clock },
  { id: 5, label: 'Review', icon: CheckCircle },
];

export default function ComposePage() {
  const { senders, isLoading: sendersLoading, refresh: refreshSenders } = useSenders();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Sender state
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [isAddingSender, setIsAddingSender] = useState(false);
  const [addSenderError, setAddSenderError] = useState<string | null>(null);

  // Step 2: Recipients state
  const [rawTextRecipients, setRawTextRecipients] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Step 3: Content state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Step 4: Schedule state
  const nowIso = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);
  const [startAt, setStartAt] = useState(nowIso);
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  // Step 5: Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  // Auto-select first active sender
  React.useEffect(() => {
    if (senders.length > 0 && !selectedSenderId) {
      const active = senders.find((s) => s.status === 'ACTIVE') ?? senders[0];
      if (active) setSelectedSenderId(active.id);
    }
  }, [senders, selectedSenderId]);

  // Handle adding new sender account
  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim()) return;
    setIsAddingSender(true);
    setAddSenderError(null);
    try {
      const result = await senderService.create({
        email: newSenderEmail.trim(),
        name: newSenderName.trim() || undefined,
      });
      await refreshSenders();
      setSelectedSenderId(result.sender.id);
      setShowAddSender(false);
      setNewSenderEmail('');
      setNewSenderName('');
    } catch (err: any) {
      setAddSenderError(err.message || 'Failed to add sender account');
    } finally {
      setIsAddingSender(false);
    }
  };

  // Helper to extract and validate emails from text or CSV
  const parseEmails = (input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const lines = input.split(/[\r\n,;]+/);
    const validSet = new Set<string>();
    let invalid = 0;

    for (const raw of lines) {
      const trimmed = raw.trim().replace(/^["']|["']$/g, '');
      if (!trimmed || trimmed.toLowerCase() === 'email' || trimmed.toLowerCase() === 'recipient') {
        continue;
      }
      if (emailRegex.test(trimmed)) {
        validSet.add(trimmed.toLowerCase());
      } else {
        invalid++;
      }
    }

    setParsedRecipients(Array.from(validSet));
    setInvalidCount(invalid);
  };

  // Handle file drop / upload
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawTextRecipients(text);
      parseEmails(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Submit campaign to backend
  const handleSubmitCampaign = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Validate authoritative parameters
      if (!selectedSenderId) throw new Error('Please select a sender account');
      if (parsedRecipients.length === 0) throw new Error('Please provide at least one valid recipient');
      if (!subject.trim()) throw new Error('Subject line is required');
      if (!body.trim()) throw new Error('Email body is required');

      const payload = {
        senderId: selectedSenderId,
        recipients: parsedRecipients,
        subject: subject.trim(),
        body: body.trim(),
        startAt: new Date(startAt).toISOString(),
        delayMs: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
      };

      const result = await campaignService.create(payload);
      setCreatedCampaignId(result.campaignId);
      setCurrentStep(6); // Success screen (Screen 8)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to schedule campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selected sender object
  const currentSender = senders.find((s) => s.id === selectedSenderId);

  // ─── Step 6: Success Screen (Screen 8 in reference) ─────────────────────────
  if (currentStep === 6) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="p-8 sm:p-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-600 mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Campaign Scheduled Successfully!
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Your campaign has been created and {parsedRecipients.length} emails are queued for delivery via BullMQ delayed jobs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-left max-w-md mx-auto space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Subject:</span>
              <span className="font-semibold text-slate-800 truncate max-w-[200px]">{subject}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Start Time:</span>
              <span className="font-semibold text-slate-800">{new Date(startAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Delay / Limit:</span>
              <span className="font-semibold text-slate-800">{delayMs}ms / {hourlyLimit} per hr</span>
            </div>
            {createdCampaignId && (
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-400">Campaign ID:</span>
                <span className="font-mono text-slate-500 text-[10px]">{createdCampaignId}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/dashboard/scheduled"
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all duration-150"
            >
              View Scheduled Emails
            </Link>
            <Link
              href="/dashboard/campaigns"
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all duration-150"
            >
              View Campaigns
            </Link>
            <button
              onClick={() => {
                setCurrentStep(1);
                setSubject('');
                setBody('');
                setRawTextRecipients('');
                setParsedRecipients([]);
                setCreatedCampaignId(null);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
            >
              Create Another
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compose New Campaign</h1>
          <p className="text-sm text-slate-500">Configure and schedule deterministic email delivery</p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          Cancel
        </Link>
      </div>

      {/* ─── Stepper Bar (Screens 2–7) ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  disabled={step.id > currentStep}
                  className={`flex items-center gap-2 group text-left ${
                    step.id < currentStep ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-50'
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : step.id}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline-block ${
                      isActive ? 'text-blue-600 font-semibold' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded transition-colors ${
                      currentStep > idx + 1 ? 'bg-emerald-500/70' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ─── Wizard Content Card ─────────────────────────────────────────── */}
      <Card className="p-6 sm:p-8">
        {/* STEP 1: SELECT SENDER (Screen 2) */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Select Sender Account</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the verified sender account to dispatch this campaign.
              </p>
            </div>

            {sendersLoading ? (
              <div className="py-8 flex justify-center">
                <Spinner />
              </div>
            ) : senders.length === 0 && !showAddSender ? (
              <EmptyState
                title="No sender accounts found"
                description="You need at least one connected sender account before you can schedule campaigns."
                action={
                  <button
                    onClick={() => setShowAddSender(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
                  >
                    <Plus className="w-4 h-4" />
                    Connect Sender
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {senders.map((s) => (
                    <label
                      key={s.id}
                      className={`relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedSenderId === s.id
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sender"
                        value={s.id}
                        checked={selectedSenderId === s.id}
                        onChange={() => setSelectedSenderId(s.id)}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {s.name || s.email.split('@')[0]}
                          </p>
                          <StatusBadge status={s.status} />
                        </div>
                        <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{s.email}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {!showAddSender && (
                  <button
                    type="button"
                    onClick={() => setShowAddSender(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium pt-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect another sender</span>
                  </button>
                )}
              </div>
            )}

            {/* Inline Add Sender Form */}
            {showAddSender && (
              <form onSubmit={handleAddSender} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Connect New Sender Account
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Sender Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={newSenderEmail}
                      onChange={(e) => setNewSenderEmail(e.target.value)}
                      placeholder="marketing@reachinbox.ai"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newSenderName}
                      onChange={(e) => setNewSenderName(e.target.value)}
                      placeholder="Growth Team"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {addSenderError && <p className="text-xs text-rose-600">{addSenderError}</p>}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isAddingSender}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {isAddingSender ? 'Connecting...' : 'Save Sender'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSender(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Next Action */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={!selectedSenderId}
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Next: Add Recipients</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: RECIPIENTS UPLOAD & PREVIEW (Screens 3 & 4) */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Upload Recipients</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Drop your CSV file or paste email addresses directly. Automatic deduplication and syntax validation are applied.
              </p>
            </div>

            {/* CSV Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`p-8 rounded-xl border-2 border-dashed text-center transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                Drag and drop your CSV file here
              </p>
              <p className="text-[11px] text-slate-400 mt-1 mb-4">
                Supports `.csv` files with an <code className="text-slate-600 font-mono">email</code> column header or plain address lists.
              </p>

              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs hover:bg-slate-50 cursor-pointer transition-colors">
                <span>Browse CSV File</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {/* Or Paste Direct Textarea */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Or paste email list directly (separated by commas or new lines)
              </label>
              <textarea
                rows={4}
                value={rawTextRecipients}
                onChange={(e) => {
                  setRawTextRecipients(e.target.value);
                  parseEmails(e.target.value);
                }}
                placeholder="alice@example.com&#10;bob@example.com&#10;carol@example.com"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Detected Recipients Preview Table (Screen 4) */}
            {parsedRecipients.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Recipients ({parsedRecipients.length.toLocaleString()} detected)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                      Valid & Deduplicated
                    </span>
                  </div>
                  {invalidCount > 0 && (
                    <span className="text-xs text-rose-500 font-medium">
                      {invalidCount} invalid rows discarded
                    </span>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 font-semibold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Recipient Email</th>
                        <th className="px-4 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {parsedRecipients.slice(0, 50).map((email, idx) => (
                        <tr key={email} className="hover:bg-slate-50/70">
                          <td className="px-4 py-1.5 text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="px-4 py-1.5 text-slate-800">{email}</td>
                          <td className="px-4 py-1.5 text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Valid
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedRecipients.length > 50 && (
                  <p className="text-[11px] text-slate-400 text-center">
                    Showing first 50 of {parsedRecipients.length.toLocaleString()} total recipients
                  </p>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={parsedRecipients.length === 0}
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Next: Email Content</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: EMAIL CONTENT (Screen 5) */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Email Content</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compose the subject line and message body to be dispatched to your recipients.
              </p>
            </div>

            {/* Subject Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Line *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Exciting Opportunity For Your Team"
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Body Field & Formatting Toolbar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Email Message Body *
                </label>
                <span className="text-[11px] text-slate-400">
                  {body.length} characters ({body.split(/\s+/).filter(Boolean).length} words)
                </span>
              </div>

              {/* Simple Formatting Helpers Bar */}
              <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-t-lg text-slate-600 text-xs">
                <button
                  type="button"
                  onClick={() => setBody((prev) => prev + '**Bold Text**')}
                  className="px-2 py-1 rounded hover:bg-slate-200/70 font-bold"
                  title="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => setBody((prev) => prev + '*Italic Text*')}
                  className="px-2 py-1 rounded hover:bg-slate-200/70 italic font-serif"
                  title="Italic"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => setBody((prev) => prev + '\n- Bullet item')}
                  className="px-2 py-1 rounded hover:bg-slate-200/70"
                  title="Bullet list"
                >
                  • List
                </button>
                <button
                  type="button"
                  onClick={() => setBody((prev) => prev + ' [link text](https://example.com)')}
                  className="px-2 py-1 rounded hover:bg-slate-200/70 text-[11px]"
                  title="Link"
                >
                  Link
                </button>
              </div>

              <textarea
                rows={8}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi there,&#10;&#10;I hope this email finds you well. I noticed what your team is building and wanted to reach out regarding an exciting collaboration...&#10;&#10;Best regards,&#10;The Team"
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-t-0 border-slate-200 rounded-b-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans leading-relaxed"
              />
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={!subject.trim() || !body.trim()}
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Next: Schedule Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SCHEDULE SETTINGS (Screen 6) */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Schedule Campaign</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure delivery timing, spacing between emails, and hourly rate limits.
              </p>
            </div>

            <div className="space-y-4">
              {/* Start Date & Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date & Time (Local) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full sm:w-72 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  When BullMQ delayed jobs will start releasing emails for delivery.
                </p>
              </div>

              {/* Delay between emails */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Delay Between Consecutive Emails (milliseconds) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={86400000}
                    step={500}
                    value={delayMs}
                    onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full sm:w-48 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    = {(delayMs / 1000).toFixed(1)} seconds per email
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Deterministic spacing formula: <code className="font-mono text-slate-600">scheduledAt = startAt + index * delayMs</code>
                </p>
              </div>

              {/* Hourly Limit */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hourly Rate Limit (emails / hour) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full sm:w-48 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-500 font-medium">max per hour</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enforced globally across all workers using Redis distributed sliding-window token bucket.
                </p>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <span>Next: Review Campaign</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & CONFIRM (Screen 7) */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Review Campaign Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify all campaign settings before scheduling BullMQ delayed jobs.
              </p>
            </div>

            {submitError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sender Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Sender Account</span>
                  <StatusBadge status={currentSender?.status || 'ACTIVE'} />
                </div>
                <p className="text-sm font-bold text-slate-800">{currentSender?.name || 'Verified Sender'}</p>
                <p className="text-xs text-slate-500 font-mono">{currentSender?.email}</p>
              </div>

              {/* Recipients Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Recipients Count</span>
                <p className="text-2xl font-bold text-slate-900">{parsedRecipients.length.toLocaleString()}</p>
                <p className="text-xs text-emerald-600 font-medium">100% valid & deduplicated</p>
              </div>

              {/* Content Preview Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Email Preview</span>
                <p className="text-xs font-bold text-slate-800">{subject}</p>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{body}</p>
              </div>

              {/* Schedule Details Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase text-slate-400">Delivery Rules</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <span className="text-slate-400">First Email At:</span>
                    <p className="font-semibold text-slate-800">{new Date(startAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Delay:</span>
                    <p className="font-semibold text-slate-800">{delayMs} ms ({(delayMs / 1000).toFixed(1)}s)</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Hourly Rate Limit:</span>
                    <p className="font-semibold text-slate-800">{hourlyLimit} emails / hr</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitCampaign}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="border-white" />
                    <span>Scheduling Campaign...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Schedule Campaign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
