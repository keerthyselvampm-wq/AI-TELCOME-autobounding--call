import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Save, X, RefreshCw, BookOpen, Search } from 'lucide-react'
import { api } from '../../api/client'
import type { KnowledgeEntry } from '../../types'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import Toast from '../../components/admin/Toast'

const categories = ['internship', 'company', 'policies', 'contact', 'general']

export default function KnowledgeManager() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<any>({ category: 'general', key: '', content: '', tags: '', language: 'english', is_active: true })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ id: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.admin.listKnowledge(filter || undefined)
      setEntries(data)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const saveEntry = async () => {
    if (!form.key || !form.content) {
      setToast({ type: 'error', text: 'Key and Content are required' })
      return
    }
    try {
      if (editing) {
        await api.admin.updateKnowledge(editing, form)
        setToast({ type: 'success', text: 'Knowledge entry updated' })
      } else {
        await api.admin.createKnowledge(form)
        setToast({ type: 'success', text: 'Knowledge entry created' })
      }
      setShowForm(false)
      setEditing(null)
      setForm({ category: 'general', key: '', content: '', tags: '', language: 'english', is_active: true })
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const deleteEntry = async () => {
    if (!confirm) return
    try {
      await api.admin.deleteKnowledge(confirm.id)
      setToast({ type: 'success', text: 'Entry deleted' })
      setConfirm(null)
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const startEdit = (e: KnowledgeEntry) => {
    setEditing(e.id)
    setForm({ ...e, is_active: Boolean(e.is_active) })
    setShowForm(true)
  }

  const filtered = search
    ? entries.filter((e) =>
        e.key.toLowerCase().includes(search.toLowerCase()) ||
        e.content.toLowerCase().includes(search.toLowerCase()) ||
        (e.tags || '').toLowerCase().includes(search.toLowerCase())
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
        title="Delete Knowledge Entry"
        message="Are you sure you want to delete this knowledge entry? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteEntry}
        onCancel={() => setConfirm(null)}
      />

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500">Manage knowledge entries for the AI assistant</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-9 w-44"
              placeholder="Search entries..."
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
          onClick={() => { setEditing(null); setShowForm(true); setForm({ category: 'general', key: '', content: '', tags: '', language: 'english', is_active: true }) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Category *</label>
              <select
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Key *</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="e.g., internship_domains"
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
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Tags (comma separated)</label>
            <input
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
              value={form.tags || ''}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="domain, eligibility, fee"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Content *</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-32"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="knowledge-active"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
            />
            <label htmlFor="knowledge-active" className="text-sm font-medium text-gray-700">Active</label>
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
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">{search ? 'No entries match your search.' : 'No knowledge entries yet. Click "Add Entry" to create one.'}</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((e) => (
          <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{e.category}</span>
                  <span className="text-sm font-semibold text-gray-900 truncate">{e.key}</span>
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
              <p className="text-sm text-gray-600 line-clamp-2">{e.content}</p>
              {e.tags && <p className="text-xs text-gray-400 mt-2"><span className="font-medium text-gray-500">Tags:</span> {e.tags}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
