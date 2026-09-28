'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSenders } from '../../../hooks/useCampaigns';
import { campaignService, senderService } from '../../../services/campaign.service';
import { contactService } from '../../../services/contact.service';
import { Contact } from '@reachinbox/shared';
import {
  Card,
  Spinner,
  PageHeader,
} from '../../../components/ui';
import {
  CheckCircle2,
  Upload,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Download,
  Check,
  Users,
  Search,
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Details', number: '01' },
  { id: 2, title: 'Recipients', number: '02' },
  { id: 3, title: 'Content', number: '03' },
  { id: 4, title: 'Schedule', number: '04' },
  { id: 5, title: 'Review', number: '05' },
];

export default function ComposePage() {
  const { senders, isLoading: sendersLoading, refresh: refreshSenders } = useSenders();

  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Details
  const [campaignName, setCampaignName] = useState('Product Launch Email');
  const [description, setDescription] = useState('Announcing our new product to early users');
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [isAddingSender, setIsAddingSender] = useState(false);

  // Step 2: Recipients
  const [recipientTab, setRecipientTab] = useState<'CSV' | 'MANUAL' | 'CONTACTS'>('CSV');
  const [rawTextRecipients, setRawTextRecipients] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([
    'john@example.com',
    'sarah@example.com',
    'mike@example.com',
    'emma@example.com',
    'david@example.com',
  ]);
  const [fileName, setFileName] = useState<string | null>('recipients_list.csv');
  const [isDragging, setIsDragging] = useState(false);

  // Contacts picker state
  const [contactsList, setContactsList] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactTagFilter, setContactTagFilter] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedContactEmails, setSelectedContactEmails] = useState<Set<string>>(new Set());

  // Load contacts when tab is switched to CONTACTS
  useEffect(() => {
    if (recipientTab === 'CONTACTS') {
      setContactsLoading(true);
      Promise.all([
        contactService.getContacts({ limit: 100 }),
        contactService.getTags(),
      ])
        .then(([contactsRes, tagsRes]) => {
          if (contactsRes.data) setContactsList(contactsRes.data);
          if (tagsRes.data) setAvailableTags(tagsRes.data);
        })
        .catch(() => {})
        .finally(() => setContactsLoading(false));
    }
  }, [recipientTab]);

  // Step 3: Content
  const [subject, setSubject] = useState('Exciting Product Launch 🚀');
  const [body, setBody] = useState(
    "Hi {name},\n\nWe're excited to announce the launch of our new product! This is just the beginning of an amazing journey, and we're thrilled to have you with us.\n\nBest regards,\nThe ReachInbox Team"
  );

  // Step 4: Schedule
  const nowIso = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);
  const [startAt, setStartAt] = useState(nowIso);
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(500);

  // Step 5: Submission
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

  // Handle adding sender
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

  // Parse emails helper
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

    try {
      const response = await campaignService.create({
        senderId: selectedSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: parsedRecipients,
        startAt: new Date(startAt).toISOString(),
        delayMs: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
      });

      setCreatedCampaignId(response.campaignId);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to schedule campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSender = senders.find((s) => s.id === selectedSenderId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Create Campaign"
        description="Choose recipients, compose your email, and set dispatch rate limits."
        actions={
          <Link
            href="/dashboard/campaigns"
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </Link>
        }
      />

      {/* ─── 5-Step Stepper Bar ──────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id);
                }}
                className={`flex items-center gap-2 p-2 rounded-md transition-all text-left ${
                  isCurrent
                    ? 'bg-blue-50 border border-blue-200 text-blue-700'
                    : isCompleted
                    ? 'text-slate-700 hover:bg-slate-50'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.number}
                </div>
                <div className="hidden sm:block truncate">
                  <p className="text-xs font-semibold tracking-tight">{step.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Step Content Container ──────────────────────────────────────── */}
      {createdCampaignId ? (
        /* Success Screen */
        <Card className="p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Campaign Successfully Scheduled!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Your {parsedRecipients.length.toLocaleString()} emails have been securely written to PostgreSQL and enqueued in BullMQ Redis delayed sets.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-3">
            <Link
              href={`/dashboard/campaigns/${createdCampaignId}`}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow-xs"
            >
              View Campaign &rarr;
            </Link>
            <Link
              href="/dashboard/scheduled"
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Scheduled Queue
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          {/* STEP 1: DETAILS */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Campaign Details</h2>
                <p className="text-xs text-slate-500">Basic information about your campaign.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Q4 Feature Announcement"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief objective of this campaign"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Sender Account <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddSender(!showAddSender)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      + Add Sender
                    </button>
                  </div>

                  {sendersLoading ? (
                    <div className="p-2 text-xs text-slate-400">Loading senders...</div>
                  ) : senders.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      No active sender account found. Please create one to send emails.
                    </div>
                  ) : (
                    <select
                      value={selectedSenderId}
                      onChange={(e) => setSelectedSenderId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {senders.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name ? `${s.name} <${s.email}>` : s.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {showAddSender && (
                  <form onSubmit={handleAddSender} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <h4 className="text-xs font-semibold text-slate-800">Quick Add Sender</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newSenderName}
                        onChange={(e) => setNewSenderName(e.target.value)}
                        placeholder="Sender Name (e.g. Sales Team)"
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                      />
                      <input
                        type="email"
                        value={newSenderEmail}
                        onChange={(e) => setNewSenderEmail(e.target.value)}
                        placeholder="Sender Email"
                        required
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSender(false)}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isAddingSender}
                        className="px-3 py-1 text-xs bg-blue-600 text-white font-semibold rounded hover:bg-blue-500"
                      >
                        {isAddingSender ? 'Saving...' : 'Save Sender'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs"
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
                <h2 className="text-base font-semibold text-slate-900">Add Recipients</h2>
                <p className="text-xs text-slate-500">Upload a CSV file or add recipients manually.</p>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setRecipientTab('CSV')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    recipientTab === 'CSV'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Upload CSV
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab('MANUAL')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    recipientTab === 'MANUAL'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Add Manually
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab('CONTACTS')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5 ${
                    recipientTab === 'CONTACTS'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Select from Contacts
                </button>
              </div>

              {recipientTab === 'CSV' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Upload CSV File</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Drag and drop your CSV file here, or click to browse. Supports CSV files with email addresses.
                  </p>

                  <div className="flex items-center justify-center gap-3 mt-4">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs">
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
                    <button
                      type="button"
                      onClick={() => {
                        const csvContent = 'email\njohn@example.com\nsarah@example.com\nmike@example.com\nemma@example.com';
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'sample_recipients.csv';
                        a.click();
                      }}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download CSV template</span>
                    </button>
                  </div>

                  {fileName && (
                    <p className="text-xs text-emerald-600 font-medium mt-3">
                      Selected: {fileName} ({parsedRecipients.length} emails detected)
                    </p>
                  )}
                </div>
              ) : recipientTab === 'MANUAL' ? (
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
                    className="w-full p-3 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Contacts Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search contacts..."
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <select
                        value={contactTagFilter}
                        onChange={(e) => setContactTagFilter(e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded-md py-1.5 px-2 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
                          const updatedRecipients = Array.from(new Set([...parsedRecipients, ...Array.from(newEmails)]));
                          setParsedRecipients(updatedRecipients);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                      >
                        Select All Filtered
                      </button>
                    </div>
                  </div>

                  {/* Contacts List Box */}
                  <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {contactsLoading ? (
                      <div className="py-8 text-center text-xs text-slate-400">Loading your contacts...</div>
                    ) : contactsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No contacts saved yet.{' '}
                        <Link href="/dashboard/contacts" className="text-blue-600 font-semibold underline">
                          Go to Contacts
                        </Link>{' '}
                        to create or import recipients.
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
                                    {[contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
                                      contact.email}
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
                                    className="px-1.5 py-0.2 rounded-xs text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
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
              )}

              {/* Status Banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Detected Recipients:{' '}
                  <strong className="text-slate-900">{parsedRecipients.length.toLocaleString()} valid</strong>
                </span>
                <span className="text-[11px] text-slate-400">Duplicates are automatically purged</span>
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Next: Content</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONTENT */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Email Content</h2>
                <p className="text-xs text-slate-500">Write your email content or use dynamic variables.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Subject Line</label>
                    <button
                      type="button"
                      onClick={() => setSubject((s) => `${s} {name}`)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Insert Variable <code className="bg-slate-100 px-1 rounded">{'{name}'}</code>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  {/* Formatting Toolbar */}
                  <div className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 rounded-t-lg text-slate-600 text-xs">
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded font-semibold cursor-pointer">B</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded italic cursor-pointer">I</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded cursor-pointer">Link</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded cursor-pointer">&bull; List</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBody((b) => `${b} {name}`)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + {'{name}'}
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your email body here..."
                    className="w-full p-3 text-xs bg-white border border-t-0 border-slate-200 rounded-b-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                  />
                </div>
              </div>

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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Next: Schedule</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SCHEDULE */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Schedule Campaign</h2>
                <p className="text-xs text-slate-500">
                  Choose when to send your emails and configure sending limits.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date &amp; Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full sm:w-72 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Emails will begin dispatching via BullMQ delayed jobs at this exact timestamp.
                  </p>
                </div>

                <div className="pt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Email Sending Configuration
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Delay between emails (seconds)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={delayMs / 1000}
                        onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) * 1000))}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Enforces minimum inter-email spacing via Redis delivery policy ({delayMs} ms).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Max emails per hour
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={hourlyLimit}
                        onChange={(e) => setHourlyLimit(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Excess jobs will be rescheduled automatically without message loss.
                      </p>
                    </div>
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs"
                >
                  <span>Next: Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Review &amp; Confirm</h2>
                <p className="text-xs text-slate-500">
                  Please review your campaign parameters before scheduling.
                </p>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
                <div className="p-3.5 flex justify-between items-center bg-slate-50/50">
                  <span className="font-semibold text-slate-500">Campaign Name</span>
                  <span className="font-bold text-slate-900">{campaignName}</span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Sender Account</span>
                  <span className="font-mono text-slate-800">{selectedSender?.email ?? 'Selected Sender'}</span>
                </div>
                <div className="p-3.5 flex justify-between items-center bg-slate-50/50">
                  <span className="font-semibold text-slate-500">Recipients Count</span>
                  <span className="font-bold text-slate-900">{parsedRecipients.length.toLocaleString()} verified emails</span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Start Time</span>
                  <span className="font-mono text-slate-800">{new Date(startAt).toLocaleString()}</span>
                </div>
                <div className="p-3.5 flex justify-between items-center bg-slate-50/50">
                  <span className="font-semibold text-slate-500">Delivery Rules</span>
                  <span className="text-slate-800 font-medium">
                    {delayMs / 1000}s inter-email delay &bull; {hourlyLimit} emails/hour max
                  </span>
                </div>
                <div className="p-3.5 space-y-1">
                  <span className="font-semibold text-slate-500 block">Email Subject</span>
                  <p className="text-slate-900 font-medium">{subject}</p>
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="border-white" />
                      <span>Scheduling in BullMQ...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Campaign</span>
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
