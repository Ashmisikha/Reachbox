'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSenders } from '../../../hooks/useCampaigns';
import { campaignService, senderService } from '../../../services/campaign.service';
import { contactService } from '../../../services/contact.service';
import { templateService } from '../../../services/template.service';
import { Contact, EmailTemplate, CreateCampaignStepInput } from '@reachinbox/shared';
import { Card, Spinner } from '../../../components/ui';
import {
  CheckCircle2,
  Upload,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Check,
  Users,
  Search,
  Plus,
  Trash2,
  Sparkles,
  Eye,
  FileText,
  Clock,
  Smartphone,
  Monitor,
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Details', number: '01' },
  { id: 2, title: 'Recipients', number: '02' },
  { id: 3, title: 'Content & Variables', number: '03' },
  { id: 4, title: 'Sequences & Timing', number: '04' },
  { id: 5, title: 'Review & Schedule', number: '05' },
];

const PERSONALIZATION_VARS = [
  { label: 'First Name', tag: '{{firstName}}' },
  { label: 'Last Name', tag: '{{lastName}}' },
  { label: 'Company', tag: '{{company}}' },
  { label: 'Job Title', tag: '{{jobTitle}}' },
  { label: 'Email', tag: '{{email}}' },
];

interface FollowUpStep {
  id: string;
  delayDays: number;
  delayHours: number;
  subject: string;
  body: string;
}

function ComposeContent() {
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get('templateId');

  const { senders, isLoading: sendersLoading, refresh: refreshSenders } = useSenders();

  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Details
  const [campaignName, setCampaignName] = useState('Outreach Campaign');
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [isAddingSender, setIsAddingSender] = useState(false);

  // Step 2: Recipients
  const [recipientTab, setRecipientTab] = useState<'CSV' | 'MANUAL' | 'CONTACTS'>('CONTACTS');
  const [rawTextRecipients, setRawTextRecipients] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Contacts picker
  const [contactsList, setContactsList] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactTagFilter, setContactTagFilter] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedContactEmails, setSelectedContactEmails] = useState<Set<string>>(new Set());

  // Step 3: Content & Personalization
  const [subject, setSubject] = useState('Quick question regarding {{company}}');
  const [body, setBody] = useState(
    'Hi {{firstName}},\n\nI noticed your work as {{jobTitle}} at {{company}}.\n\nWould love to connect!\n\nBest regards,\nReachInbox'
  );
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  // Preview Mode
  const [previewContactId, setPreviewContactId] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activePreviewTab, setActivePreviewTab] = useState<'editor' | 'preview'>('editor');

  // Step 4: Multi-Step Sequences & Schedule
  const nowIso = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);
  const [startAt, setStartAt] = useState(nowIso);
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [followUpSteps, setFollowUpSteps] = useState<FollowUpStep[]>([]);

  // Step 5: Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  // Load contacts and templates on mount
  useEffect(() => {
    setContactsLoading(true);
    contactService
      .list({ limit: 100 })
      .then((res) => {
        const contacts = res.data ?? [];
        setContactsList(contacts);
        if (contacts.length > 0 && contacts[0]) {
          setPreviewContactId(contacts[0].id);
          // If no recipients yet, auto-select first 5 contacts
          if (parsedRecipients.length === 0) {
            const initialEmails = contacts.slice(0, 5).map((c: Contact) => c.email.toLowerCase());
            setParsedRecipients(initialEmails);
            setSelectedContactEmails(new Set(initialEmails));
          }
        }
      })
      .catch(() => {})
      .finally(() => setContactsLoading(false));

    contactService.getTags().then((tags) => setAvailableTags(tags.data ?? [])).catch(() => {});

    templateService
      .list('', 1, 50)
      .then((res) => {
        setTemplates(res.templates);
        if (templateIdParam) {
          const found = res.templates.find((t) => t.id === templateIdParam);
          if (found) {
            setSubject(found.subject);
            setBody(found.body);
            setCampaignName(`Campaign - ${found.name}`);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateIdParam]);

  // Auto-select first active sender
  useEffect(() => {
    if (senders.length > 0 && !selectedSenderId) {
      const active = senders.find((s) => s.status === 'ACTIVE') ?? senders[0];
      if (active) setSelectedSenderId(active.id);
    }
  }, [senders, selectedSenderId]);

  // Update preview when contact, subject, or body changes
  useEffect(() => {
    const contact = contactsList.find((c) => c.id === previewContactId);
    const context = {
      firstName: contact?.firstName || 'John',
      lastName: contact?.lastName || 'Doe',
      company: contact?.company || 'Acme Corp',
      jobTitle: contact?.jobTitle || 'VP of Growth',
      email: contact?.email || 'john@acme.com',
    };

    let renderedSub = subject;
    let renderedBdy = body;
    for (const [k, v] of Object.entries(context)) {
      const reg = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      renderedSub = renderedSub.replace(reg, v);
      renderedBdy = renderedBdy.replace(reg, v);
    }
    setPreviewSubject(renderedSub);
    setPreviewBody(renderedBdy);
  }, [subject, body, previewContactId, contactsList]);

  // Add Sender
  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim()) return;
    setIsAddingSender(true);
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
      alert(err.message || 'Failed to add sender');
    } finally {
      setIsAddingSender(false);
    }
  };

  const parseEmails = (input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const lines = input.split(/[\r\n,;]+/);
    const validSet = new Set<string>();

    for (const raw of lines) {
      const trimmed = raw.trim().replace(/^["']|["']$/g, '');
      if (trimmed && emailRegex.test(trimmed)) {
        validSet.add(trimmed.toLowerCase());
      }
    }
    const arr = Array.from(validSet);
    setParsedRecipients(arr);
    return arr;
  };

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setRawTextRecipients(text);
        parseEmails(text);
      }
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

  const addFollowUpStep = () => {
    const newStep: FollowUpStep = {
      id: String(Date.now()),
      delayDays: followUpSteps.length === 0 ? 2 : 5,
      delayHours: 0,
      subject: `Re: ${subject}`,
      body: 'Hi {{firstName}},\n\nJust following up on my previous note. Would love to hear your thoughts.\n\nBest,\nReachInbox',
    };
    setFollowUpSteps([...followUpSteps, newStep]);
  };

  const removeFollowUpStep = (id: string) => {
    setFollowUpSteps(followUpSteps.filter((s) => s.id !== id));
  };

  const updateFollowUpStep = (id: string, updates: Partial<FollowUpStep>) => {
    setFollowUpSteps(followUpSteps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Submit campaign
  const handleCreateCampaign = async () => {
    if (!selectedSenderId) {
      setSubmitError('Please select a sender account.');
      return;
    }
    if (parsedRecipients.length === 0) {
      setSubmitError('Please provide at least one valid recipient.');
      return;
    }
    if (!subject.trim()) {
      setSubmitError('Please enter an email subject.');
      return;
    }
    if (!body.trim()) {
      setSubmitError('Please enter email body content.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const stepsPayload: CreateCampaignStepInput[] = [
      {
        stepOrder: 1,
        delayDays: 0,
        delayHours: 0,
        subject: subject.trim(),
        body: body.trim(),
      },
      ...followUpSteps.map((s, idx) => ({
        stepOrder: idx + 2,
        delayDays: Number(s.delayDays),
        delayHours: Number(s.delayHours),
        subject: s.subject.trim(),
        body: s.body.trim(),
      })),
    ];

    try {
      const response = await campaignService.create({
        senderId: selectedSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: parsedRecipients,
        startAt: new Date(startAt).toISOString(),
        delayMs: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
        steps: stepsPayload,
      });

      setCreatedCampaignId(response.campaignId);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSender = senders.find((s) => s.id === selectedSenderId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">New Email Campaign</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Schedule personalized outreach with multi-step follow-ups via BullMQ.
        </p>
      </div>

      {/* Stepper Progress */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;

            return (
              <React.Fragment key={s.id}>
                <div
                  onClick={() => {
                    if (isCompleted) setCurrentStep(s.id);
                  }}
                  className={`flex items-center gap-2 cursor-pointer ${
                    isCurrent
                      ? 'text-blue-600 font-semibold'
                      : isCompleted
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.number}
                  </div>
                  <span className="text-xs hidden sm:inline">{s.title}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      currentStep > s.id ? 'bg-emerald-300' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Success State */}
      {createdCampaignId ? (
        <Card className="p-8 text-center bg-white border border-slate-200">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Campaign Scheduled Successfully!</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            {parsedRecipients.length.toLocaleString()} recipients have been queued across{' '}
            {followUpSteps.length + 1} sequence step(s). Delayed jobs are persistent in BullMQ and Redis.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link
              href={`/dashboard/campaigns/${createdCampaignId}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
            >
              View Campaign Analytics
            </Link>
            <Link
              href="/dashboard/campaigns"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors"
            >
              All Campaigns
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="p-6 bg-white border border-slate-200 shadow-2xs">
          {/* STEP 1: DETAILS */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Campaign Details</h2>
                <p className="text-xs text-slate-500">Configure your campaign name and sender identity.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Q4 Growth Outreach"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sender Account
                  </label>
                  {sendersLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <Spinner size="sm" /> Loading sender accounts...
                    </div>
                  ) : senders.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                      No active sender accounts found. Please add a sender below before continuing.
                    </div>
                  ) : (
                    <select
                      value={selectedSenderId}
                      onChange={(e) => setSelectedSenderId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    >
                      {senders.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name ? `${s.name} <${s.email}>` : s.email} ({s.status})
                        </option>
                      ))}
                    </select>
                  )}

                  {!showAddSender && (
                    <button
                      type="button"
                      onClick={() => setShowAddSender(true)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add new sender</span>
                    </button>
                  )}

                  {showAddSender && (
                    <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                      <h4 className="text-xs font-semibold text-slate-800">Add Sender Account</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="email"
                          placeholder="Sender Email"
                          value={newSenderEmail}
                          onChange={(e) => setNewSenderEmail(e.target.value)}
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="Sender Name (Optional)"
                          value={newSenderName}
                          onChange={(e) => setNewSenderName(e.target.value)}
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAddSender(false)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSender}
                          disabled={isAddingSender}
                          className="px-3 py-1 text-xs bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                        >
                          {isAddingSender ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!selectedSenderId}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Next: Recipients</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: RECIPIENTS */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Add Recipients</h2>
                <p className="text-xs text-slate-500">
                  Select from real saved contacts or upload a CSV file.
                </p>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setRecipientTab('CONTACTS')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5 ${
                    recipientTab === 'CONTACTS' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Select from Contacts
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab('CSV')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    recipientTab === 'CSV' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Upload CSV
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab('MANUAL')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    recipientTab === 'MANUAL' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Add Manually
                </button>
              </div>

              {recipientTab === 'CONTACTS' ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search contacts..."
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <select
                        value={contactTagFilter}
                        onChange={(e) => setContactTagFilter(e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded-md py-1.5 px-2 text-slate-700"
                      >
                        <option value="">All Tags</option>
                        {availableTags.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const filtered = contactsList.filter((c) => {
                            if (contactTagFilter && !c.tags?.includes(contactTagFilter)) return false;
                            if (contactSearchQuery) {
                              const q = contactSearchQuery.toLowerCase();
                              return (
                                c.email.toLowerCase().includes(q) ||
                                (c.firstName && c.firstName.toLowerCase().includes(q)) ||
                                (c.lastName && c.lastName.toLowerCase().includes(q)) ||
                                (c.company && c.company.toLowerCase().includes(q))
                              );
                            }
                            return true;
                          });
                          const newEmails = new Set(selectedContactEmails);
                          filtered.forEach((c) => newEmails.add(c.email.toLowerCase()));
                          setSelectedContactEmails(newEmails);
                          setParsedRecipients(Array.from(new Set([...parsedRecipients, ...Array.from(newEmails)])));
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                      >
                        Select All Filtered
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {contactsLoading ? (
                      <div className="py-8 text-center text-xs text-slate-400">Loading contacts...</div>
                    ) : contactsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No contacts found. Use the CSV tab or import contacts from the Contacts page.
                      </div>
                    ) : (
                      contactsList
                        .filter((c) => {
                          if (contactTagFilter && !c.tags?.includes(contactTagFilter)) return false;
                          if (contactSearchQuery) {
                            const q = contactSearchQuery.toLowerCase();
                            return (
                              c.email.toLowerCase().includes(q) ||
                              (c.firstName && c.firstName.toLowerCase().includes(q)) ||
                              (c.lastName && c.lastName.toLowerCase().includes(q)) ||
                              (c.company && c.company.toLowerCase().includes(q))
                            );
                          }
                          return true;
                        })
                        .map((contact) => {
                          const isSelected =
                            selectedContactEmails.has(contact.email.toLowerCase()) ||
                            parsedRecipients.includes(contact.email.toLowerCase());

                          return (
                            <div
                              key={contact.id}
                              onClick={() => {
                                const newSet = new Set(selectedContactEmails);
                                const emailLower = contact.email.toLowerCase();
                                if (isSelected) {
                                  newSet.delete(emailLower);
                                  setParsedRecipients(parsedRecipients.filter((e) => e !== emailLower));
                                } else {
                                  newSet.add(emailLower);
                                  setParsedRecipients(Array.from(new Set([...parsedRecipients, emailLower])));
                                }
                                setSelectedContactEmails(newSet);
                              }}
                              className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="rounded-xs border-slate-300 text-blue-600"
                                />
                                <div>
                                  <span className="font-semibold text-slate-800">
                                    {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email}
                                  </span>
                                  {contact.company && (
                                    <span className="ml-2 text-slate-400">({contact.company})</span>
                                  )}
                                  <div className="text-[11px] font-mono text-slate-500">{contact.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {contact.tags?.map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.5 rounded-xs text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              ) : recipientTab === 'CSV' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Upload CSV File</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Drag and drop your recipient CSV here, or click to browse.
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs">
                      <span>Browse Files</span>
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
                  {fileName && (
                    <p className="text-xs text-emerald-600 font-medium mt-3">
                      Selected: {fileName} ({parsedRecipients.length} emails detected)
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Paste email addresses (one per line or comma separated)
                  </label>
                  <textarea
                    rows={6}
                    value={rawTextRecipients}
                    onChange={(e) => {
                      setRawTextRecipients(e.target.value);
                      parseEmails(e.target.value);
                    }}
                    placeholder="john@example.com&#10;sarah@example.com&#10;mike@example.com"
                    className="w-full p-3 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Status Banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Target Recipients:{' '}
                  <strong className="text-slate-900">{parsedRecipients.length.toLocaleString()} verified</strong>
                </span>
                <span className="text-[11px] text-slate-400">Idempotent batching prevents duplicates</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={parsedRecipients.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Next: Content</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONTENT & PERSONALIZATION */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Email Content &amp; Personalization</h2>
                  <p className="text-xs text-slate-500">
                    Step 1 outreach message. Use dynamic variables for deterministic rendering.
                  </p>
                </div>
                {/* View toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('editor')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      activePreviewTab === 'editor' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500'
                    }`}
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('preview')}
                    className={`px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1 ${
                      activePreviewTab === 'preview' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Live Preview</span>
                  </button>
                </div>
              </div>

              {activePreviewTab === 'editor' ? (
                <div className="space-y-4">
                  {/* Template Picker */}
                  {templates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-600">Load from template:</span>
                      <select
                        onChange={(e) => {
                          const tmpl = templates.find((t) => t.id === e.target.value);
                          if (tmpl) {
                            setSubject(tmpl.subject);
                            setBody(tmpl.body);
                          }
                        }}
                        defaultValue=""
                        className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="" disabled>
                          Select template...
                        </option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Subject Line</label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Add var:
                        </span>
                        {PERSONALIZATION_VARS.map((v) => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => setSubject((s) => `${s} ${v.tag}`)}
                            className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded transition-colors"
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Quick question regarding {{company}}"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Email Body</label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Add var:
                        </span>
                        {PERSONALIZATION_VARS.map((v) => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => setBody((b) => `${b} ${v.tag}`)}
                            className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded transition-colors"
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={8}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your email body here with dynamic variables..."
                      className="w-full p-3 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono resize-y"
                    />
                  </div>
                </div>
              ) : (
                /* LIVE PREVIEW */
                <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">Preview as:</span>
                      <select
                        value={previewContactId}
                        onChange={(e) => setPreviewContactId(e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded-md py-1 px-2.5 text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      >
                        {contactsList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email} ({c.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        className={`p-1 rounded text-slate-500 ${previewDevice === 'desktop' ? 'bg-white shadow-2xs text-blue-600' : ''}`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        className={`p-1 rounded text-slate-500 ${previewDevice === 'mobile' ? 'bg-white shadow-2xs text-blue-600' : ''}`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className={`mx-auto transition-all ${previewDevice === 'mobile' ? 'max-w-xs' : 'max-w-full'}`}>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Subject</span>
                        <div className="text-xs font-bold text-slate-900">{previewSubject}</div>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Body</span>
                        <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                          {previewBody}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  disabled={!subject.trim() || !body.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Next: Sequences &amp; Timing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: MULTI-STEP SEQUENCES & SCHEDULE */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Multi-Step Sequences &amp; Delivery Limits</h2>
                <p className="text-xs text-slate-500">
                  Configure automated follow-up steps and distributed BullMQ timing rules.
                </p>
              </div>

              {/* Sequence Flow */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Campaign Steps ({followUpSteps.length + 1} Total)
                  </h3>
                  <button
                    type="button"
                    onClick={addFollowUpStep}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Follow-Up Step</span>
                  </button>
                </div>

                {/* Step 1 Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-900">Step 1 — Initial Outreach (Day 0)</h4>
                      <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Dispatches on Start Time
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-1 font-medium">{subject}</p>
                  </div>
                </div>

                {/* Follow-up Steps */}
                {followUpSteps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-2xs relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
                          {idx + 2}
                        </div>
                        <h4 className="text-xs font-semibold text-slate-900">
                          Step {idx + 2} — Follow-Up
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFollowUpStep(step.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600 font-medium">Wait</span>
                      <input
                        type="number"
                        min={0}
                        value={step.delayDays}
                        onChange={(e) => updateFollowUpStep(step.id, { delayDays: Number(e.target.value) })}
                        className="w-14 px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded text-center"
                      />
                      <span className="text-slate-600">days and</span>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={step.delayHours}
                        onChange={(e) => updateFollowUpStep(step.id, { delayHours: Number(e.target.value) })}
                        className="w-14 px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded text-center"
                      />
                      <span className="text-slate-600">hours before sending.</span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Follow-up subject..."
                        value={step.subject}
                        onChange={(e) => updateFollowUpStep(step.id, { subject: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 font-medium"
                      />
                      <textarea
                        rows={3}
                        placeholder="Follow-up body..."
                        value={step.body}
                        onChange={(e) => updateFollowUpStep(step.id, { body: e.target.value })}
                        className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Timing & Limits */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Delivery Rules &amp; Spacing
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Start Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Min Delay Between Sends
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={delayMs / 1000}
                        onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) * 1000))}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                      />
                      <span className="text-xs text-slate-500">seconds</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max Emails Per Hour
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={hourlyLimit}
                      onChange={(e) => setHourlyLimit(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Next: Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & SCHEDULE */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Review &amp; Schedule Campaign</h2>
                <p className="text-xs text-slate-500">
                  Verify real parameters before enqueuing delayed jobs into BullMQ.
                </p>
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs overflow-hidden">
                <div className="p-3 flex justify-between items-center bg-slate-50">
                  <span className="font-semibold text-slate-500">Campaign Name</span>
                  <span className="font-bold text-slate-900">{campaignName}</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Sender Identity</span>
                  <span className="font-mono text-slate-800">{selectedSender?.email ?? 'Selected Sender'}</span>
                </div>
                <div className="p-3 flex justify-between items-center bg-slate-50">
                  <span className="font-semibold text-slate-500">Recipients Count</span>
                  <span className="font-bold text-slate-900">
                    {parsedRecipients.length.toLocaleString()} verified recipients
                  </span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Sequence Steps</span>
                  <span className="font-bold text-blue-600">
                    {followUpSteps.length + 1} sequence step{followUpSteps.length > 0 ? 's' : ''}
                  </span>
                </div>
                <div className="p-3 flex justify-between items-center bg-slate-50">
                  <span className="font-semibold text-slate-500">Execution Start</span>
                  <span className="font-mono text-slate-800">{new Date(startAt).toLocaleString()}</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Throttling Rules</span>
                  <span className="text-slate-800 font-medium">
                    {delayMs / 1000}s inter-email delay &bull; {hourlyLimit} emails/hour max
                  </span>
                </div>
                <div className="p-3 space-y-1 bg-slate-50">
                  <span className="font-semibold text-slate-500 block">Initial Subject Line</span>
                  <p className="text-slate-900 font-medium font-mono text-[11px]">{subject}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateCampaign}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="border-white" />
                      <span>Scheduling in BullMQ...</span>
                    </>
                  ) : (
                    <>
                      <span>Schedule Campaign</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Spinner size="sm" />
          <span className="text-xs ml-2">Loading composer...</span>
        </div>
      }
    >
      <ComposeContent />
    </Suspense>
  );
}
