import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Save, X, RefreshCw, HelpCircle, Search } from 'lucide-react'
import { api } from '../../api/client'
import type { FaqEntry } from '../../types'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import Toast from '../../components/admin/Toast'

const categories = ['internship', 'company', 'policies', 'contact', 'general']

export default function FaqManager() {
  const [entries, setEntries] = useState<FaqEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<any>({ question: '', answer: '', keywords: '', category: '', language: 'english', is_active: true, sort_order: 0 })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ id: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.admin.listFaqs(filter || undefined)
      setEntries(data)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const saveEntry = async () => {
    if (!form.question || !form.answer) {
      setToast({ type: 'error', text: 'Question and Answer are required' })
      return
    }
    try {
      if (editing) {
        await api.admin.updateFaq(editing, form)
        setToast({ type: 'success', text: 'FAQ updated' })
      } else {
        await api.admin.createFaq(form)
        setToast({ type: 'success', text: 'FAQ created' })
      }
      setShowForm(false)
      setEditing(null)
      setForm({ question: '', answer: '', keywords: '', category: '', language: 'english', is_active: true, sort_order: 0 })
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const deleteEntry = async () => {
    if (!confirm) return
    try {
      await api.admin.deleteFaq(confirm.id)
      setToast({ type: 'success', text: 'FAQ deleted' })
      setConfirm(null)
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const startEdit = (e: FaqEntry) => {
    setEditing(e.id)
    setForm({ ...e, is_active: Boolean(e.is_active) })
    setShowForm(true)
  }

  const filtered = search
    ? entries.filter((e) =>
        e.question.toLowerCase().includes(search.toLowerCase()) ||
        e.answer.toLowerCase().includes(search.toLowerCase()) ||
        (e.keywords || '').toLowerCase().includes(search.toLowerCase())
      )
    : entries

  if (loading && entries.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="space-y-4">
      <Toast message={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Delete FAQ"
        message="Are you sure you want to delete this FAQ entry? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteEntry}
        onCancel={() => setConfirm(null)}
      />

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">FAQ Manager</h1>
        <p className="text-sm text-gray-500">Manage frequently asked questions</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-9 w-44"
              placeholder="Search FAQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 w-36"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={load}
            className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); setForm({ question: '', answer: '', keywords: '', category: '', language: 'english', is_active: true, sort_order: 0 }) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add FAQ
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Question *</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="e.g., What is the duration?"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Category</label>
              <select
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.category || ''}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">None</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Answer *</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-24"
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Keywords (comma separated)</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.keywords || ''}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="duration, fee, eligibility"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Language</label>
              <select
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="english">English</option>
                <option value="tamil">Tamil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Sort Order</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="faq-active"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
            />
            <label htmlFor="faq-active" className="text-sm font-medium text-gray-700">Active</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={saveEntry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-4 h-4" /> {editing ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditing(null) }}
              className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">{search ? 'No FAQs match your search.' : 'No FAQ entries yet. Click "Add FAQ" to create one.'}</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((e) => (
          <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <HelpCircle className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 truncate">{e.question}</span>
                  {e.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{e.category}</span>
                  )}
                  {e.is_active ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => setConfirm({ id: e.id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 line-clamp-2">{e.answer}</p>
              {e.keywords && <p className="text-xs text-gray-400 mt-2"><span className="font-medium text-gray-500">Keywords:</span> {e.keywords}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
