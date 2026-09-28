'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  Copy,
  Trash2,
  Edit2,
  Eye,
  Send,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';
import { templateService } from '../../../services/template.service';
import { contactService } from '../../../services/contact.service';
import { EmailTemplate, Contact } from '@reachinbox/shared';

const VARIABLES = [
  { label: 'First Name', tag: '{{firstName}}' },
  { label: 'Last Name', tag: '{{lastName}}' },
  { label: 'Company', tag: '{{company}}' },
  { label: 'Job Title', tag: '{{jobTitle}}' },
  { label: 'Email', tag: '{{email}}' },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  // Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await templateService.list(search, page, 20);
      setTemplates(res.templates);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    // Load contacts for preview dropdown
    contactService
      .list({ limit: 50 })
      .then((res) => {
        const contacts = res.data ?? [];
        setContacts(contacts);
        if (contacts.length > 0 && contacts[0]) {
          setSelectedContactId(contacts[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName('');
    setSubject('');
    setBody('');
    setIsEditorOpen(true);
  };

  const openEditModal = (tmpl: EmailTemplate) => {
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setSubject(tmpl.subject);
    setBody(tmpl.body);
    setIsEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) return;

    try {
      setSaving(true);
      if (editingTemplate) {
        await templateService.update(editingTemplate.id, { name, subject, body });
      } else {
        await templateService.create({ name, subject, body });
      }
      setIsEditorOpen(false);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete template "${name}"?`)) return;
    try {
      await templateService.delete(id);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete template');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await templateService.duplicate(id);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate template');
    }
  };

  const openPreview = (tmpl: EmailTemplate) => {
    setPreviewTemplate(tmpl);
    setIsPreviewOpen(true);
    runPreview(tmpl.subject, tmpl.body, selectedContactId);
  };

  const runPreview = async (sub: string, bdy: string, contactId: string) => {
    try {
      setPreviewLoading(true);
      const res = await templateService.preview({
        subject: sub,
        body: bdy,
        contactId: contactId || undefined,
      });
      setPreviewSubject(res.previewSubject);
      setPreviewBody(res.previewBody);
    } catch {
      setPreviewSubject(sub);
      setPreviewBody(bdy);
    } finally {
      setPreviewLoading(false);
    }
  };

  const insertVariable = (tag: string) => {
    setBody((prev) => prev + tag);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Email Templates</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create reusable templates with deterministic personalization variables.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Template</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates by name, subject, or content..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
          {error}
        </div>
      )}

      {/* Template Grid / List */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-xs font-medium">Loading templates...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-dashed border-slate-300 text-center px-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No templates found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {search
              ? 'No templates match your search criteria. Try a different query.'
              : 'Create your first email template with personalization variables to speed up your outreach.'}
          </p>
          {!search && (
            <button
              onClick={openCreateModal}
              className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Template</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 flex flex-col justify-between shadow-2xs transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 truncate" title={tmpl.name}>
                    {tmpl.name}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openPreview(tmpl)}
                      title="Preview personalized"
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(tmpl.id)}
                      title="Duplicate"
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(tmpl)}
                      title="Edit"
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tmpl.id, tmpl.name)}
                      title="Delete"
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs font-medium text-slate-700 truncate" title={tmpl.subject}>
                  <span className="text-slate-400 font-normal">Subject: </span>
                  {tmpl.subject}
                </div>

                <p className="mt-2 text-xs text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-line font-mono bg-slate-50 p-2 rounded border border-slate-100">
                  {tmpl.body}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Updated {new Date(tmpl.updatedAt).toLocaleDateString()}</span>
                <button
                  onClick={() => router.push(`/dashboard/compose?templateId=${tmpl.id}`)}
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>Use in Campaign</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 px-4 py-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-500 shadow-2xs">
          <span>
            Page {page} of {Math.max(1, totalPages)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Outreach - CTOs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quick question regarding {{company}}"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">Email Body</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 mr-1 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Insert variable:
                    </span>
                    {VARIABLES.map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariable(v.tag)}
                        className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded border border-slate-200 transition-colors"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={8}
                  required
                  placeholder={`Hi {{firstName}},\n\nI noticed your work as {{jobTitle}} at {{company}}.\n\nBest,\nReachInbox`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full p-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 font-mono resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-xs transition-colors"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingTemplate ? 'Save Changes' : 'Create Template'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {isPreviewOpen && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Personalized Preview</h2>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preview As Contact:
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => {
                    setSelectedContactId(e.target.value);
                    runPreview(previewTemplate.subject, previewTemplate.body, e.target.value);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  {contacts.length === 0 ? (
                    <option value="">No contacts available (using default fallback)</option>
                  ) : (
                    contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName || c.lastName
                          ? `${c.firstName || ''} ${c.lastName || ''}`.trim()
                          : c.email}{' '}
                        — {c.email} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {previewLoading ? (
                <div className="py-12 flex justify-center items-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-xs font-medium">Resolving personalization...</span>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Rendered Subject
                    </span>
                    <div className="text-xs font-semibold text-slate-900 bg-white p-2 rounded border border-slate-200">
                      {previewSubject || '<Empty Subject>'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Rendered Body
                    </span>
                    <div className="text-xs text-slate-800 bg-white p-3 rounded border border-slate-200 whitespace-pre-line leading-relaxed font-sans min-h-[120px]">
                      {previewBody || '<Empty Body>'}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Deterministic preview rendered from real database contact.
                </span>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
