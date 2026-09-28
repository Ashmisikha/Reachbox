'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Plus,
  Upload,
  Search,
  Filter,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  CheckCircle2,
  Tag,
  Building,
  Briefcase,
  Mail,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Contact, ContactImportSummary, ContactStatus } from '@reachinbox/shared';
import { contactService, CreateContactPayload, UpdateContactPayload } from '../../../services/contact.service';
import { StatusBadge } from '../../../components/ui';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Import State
  const [csvContent, setCsvContent] = useState('');
  const [importTags, setImportTags] = useState('');
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importSummary, setImportSummary] = useState<ContactImportSummary | null>(null);

  // Form State
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formJobTitle, setFormJobTitle] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formStatus, setFormStatus] = useState<ContactStatus>('ACTIVE');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await contactService.getContacts({
        search: search || undefined,
        tag: selectedTag || undefined,
        status: (selectedStatus as ContactStatus) || undefined,
        page,
        limit: 25,
      });
      setContacts(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch contacts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, selectedTag, selectedStatus, page]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await contactService.getTags();
      if (res.success && Array.isArray(res.data)) {
        setTags(res.data);
      }
    } catch {
      // Non-critical error
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await contactService.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      await fetchContacts();
      await fetchTags();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bulk delete failed';
      alert(message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await contactService.deleteContact(id);
      setDeleteConfirmId(null);
      await fetchContacts();
      await fetchTags();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      alert(message);
    }
  };

  const openAddModal = () => {
    setFormEmail('');
    setFormFirstName('');
    setFormLastName('');
    setFormCompany('');
    setFormJobTitle('');
    setFormTags('');
    setFormStatus('ACTIVE');
    setFormError(null);
    setEditingContact(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setFormEmail(contact.email);
    setFormFirstName(contact.firstName || '');
    setFormLastName(contact.lastName || '');
    setFormCompany(contact.company || '');
    setFormJobTitle(contact.jobTitle || '');
    setFormTags((contact.tags || []).join(', '));
    setFormStatus(contact.status);
    setFormError(null);
    setEditingContact(contact);
    setIsAddModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingContact) {
        const payload: UpdateContactPayload = {
          firstName: formFirstName.trim() || null,
          lastName: formLastName.trim() || null,
          company: formCompany.trim() || null,
          jobTitle: formJobTitle.trim() || null,
          tags: parsedTags,
          status: formStatus,
        };
        await contactService.updateContact(editingContact.id, payload);
      } else {
        const payload: CreateContactPayload = {
          email: formEmail.trim().toLowerCase(),
          firstName: formFirstName.trim() || null,
          lastName: formLastName.trim() || null,
          company: formCompany.trim() || null,
          jobTitle: formJobTitle.trim() || null,
          tags: parsedTags,
          status: formStatus,
        };
        await contactService.createContact(payload);
      }

      setIsAddModalOpen(false);
      await fetchContacts();
      await fetchTags();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setFormError(message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) return;

    setImportSubmitting(true);
    setImportSummary(null);

    const defaultTags = importTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await contactService.importCsv(csvContent, defaultTags);
      if (res.success && res.data) {
        setImportSummary(res.data);
        await fetchContacts();
        await fetchTags();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      alert(message);
    } finally {
      setImportSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text || '');
    };
    reader.readAsText(file);
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const active = contacts.filter((c) => c.status === 'ACTIVE').length;
    const unsub = contacts.filter((c) => c.status === 'UNSUBSCRIBED' || c.status === 'BOUNCED').length;
    return {
      total: totalCount,
      active,
      tagsCount: tags.length,
      unsub,
    };
  }, [totalCount, contacts, tags]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Contacts & Recipients
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize audience lists, assign tags, validate addresses, and build personalized outreach campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setCsvContent('');
              setImportTags('');
              setImportSummary(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Import CSV
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Contacts</span>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{metrics.total}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Audience</span>
          <div className="text-lg font-bold text-emerald-600 mt-0.5">{metrics.active}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Unique Tags</span>
          <div className="text-lg font-bold text-blue-600 mt-0.5">{metrics.tagsCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Unsub / Bounced</span>
          <div className="text-lg font-bold text-amber-600 mt-0.5">{metrics.unsub}</div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by email, name, company..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Filters & Bulk Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            {/* Tag filter */}
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
                <option value="UNSUBSCRIBED">Unsubscribed</option>
                <option value="BOUNCED">Bounced</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-medium hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedIds.size})
              </button>
            )}

            <button
              onClick={() => {
                fetchContacts();
                fetchTags();
              }}
              title="Refresh list"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
            <span>Loading contacts...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600 text-xs flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-rose-500" />
            <span>{error}</span>
            <button
              onClick={fetchContacts}
              className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-xs"
            >
              Retry
            </button>
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">No contacts yet</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {search || selectedTag || selectedStatus
                  ? 'No contacts match your active filter criteria.'
                  : 'Import your first contact list or add contacts manually.'}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700"
              >
                Import CSV
              </button>
              <button
                onClick={openAddModal}
                className="px-3 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-50"
              >
                + Add Contact
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold select-none">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === contacts.length && contacts.length > 0}
                      onChange={handleSelectAll}
                      className="rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Company & Role</th>
                  <th className="py-2.5 px-3">Tags</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Added</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((contact) => {
                  const isChecked = selectedIds.has(contact.id);
                  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

                  return (
                    <tr
                      key={contact.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isChecked ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(contact.id)}
                          className="rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{fullName || '—'}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{contact.email}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div className="flex flex-col">
                          {contact.company ? (
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Building className="w-3 h-3 text-slate-400" />
                              {contact.company}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {contact.jobTitle && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-slate-300" />
                              {contact.jobTitle}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={contact.status} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(contact)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xs transition-colors"
                            title="Edit contact"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(contact.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xs transition-colors"
                            title="Delete contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {contacts.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{contacts.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{totalCount}</span> contacts
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-1 border border-slate-200 rounded-md bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-medium text-slate-700">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-1 border border-slate-200 rounded-md bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-sm font-bold text-slate-900">
                {editingContact ? 'Edit Contact' : 'Create New Contact'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    disabled={!!editingContact} // Primary email identity immutable on edit
                    placeholder="contact@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="John"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="Doe"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    placeholder="Head of Growth"
                    value={formJobTitle}
                    onChange={(e) => setFormJobTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="saas, decision-maker, vip"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ContactStatus)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                  <option value="UNSUBSCRIBED">Unsubscribed</option>
                  <option value="BOUNCED">Bounced</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingContact ? 'Update Contact' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Import Contacts from CSV</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-5 space-y-4">
              {importSummary ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      CSV Import Processed Successfully
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="bg-white/80 p-2 rounded-md border border-emerald-100 text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-500">Imported</span>
                        <span className="text-sm font-bold text-emerald-600">{importSummary.imported}</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-md border border-emerald-100 text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-500">Duplicates</span>
                        <span className="text-sm font-bold text-amber-600">{importSummary.duplicates}</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-md border border-emerald-100 text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-500">Invalid</span>
                        <span className="text-sm font-bold text-rose-600">{importSummary.invalid}</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-md border border-emerald-100 text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-500">Skipped</span>
                        <span className="text-sm font-bold text-slate-600">{importSummary.skipped}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">Choose CSV File</label>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400">
                      Supported headers: email, firstName, lastName, company, jobTitle, tags
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Or Paste Raw CSV Data
                    </label>
                    <textarea
                      rows={5}
                      placeholder={`email,firstName,company\njohn@example.com,John,Acme Corp\nsarah@enterprise.com,Sarah,Enterprise Inc`}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      className="w-full p-2.5 text-xs font-mono border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Default Tags for this Import (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="batch-2026, q3-leads"
                      value={importTags}
                      onChange={(e) => setImportTags(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={importSubmitting || !csvContent.trim()}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {importSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        'Run Import'
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Delete Contact</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to permanently remove this contact?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSingle(deleteConfirmId)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
