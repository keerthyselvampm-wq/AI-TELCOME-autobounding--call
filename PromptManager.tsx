import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Save, X, RefreshCw, FileText, Search } from 'lucide-react'
import { api } from '../../api/client'
import type { PromptTemplate } from '../../types'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import Toast from '../../components/admin/Toast'

const agentTypes = ['internship']

export default function PromptManager() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<any>({ agent_type: 'internship', template_key: '', template_text: '', is_active: true })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ id: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.admin.listPrompts(filter || undefined)
      setPrompts(data)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const savePrompt = async () => {
    if (!form.template_key || !form.template_text) {
      setToast({ type: 'error', text: 'Template key and text are required' })
      return
    }
    try {
      if (editing) {
        await api.admin.updatePrompt(editing, form)
        setToast({ type: 'success', text: 'Prompt template updated' })
      } else {
        await api.admin.createPrompt(form)
        setToast({ type: 'success', text: 'Prompt template created' })
      }
      setShowForm(false)
      setEditing(null)
      setForm({ agent_type: 'internship', template_key: '', template_text: '', is_active: true })
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const deletePrompt = async () => {
    if (!confirm) return
    try {
      await api.admin.deletePrompt(confirm.id)
      setToast({ type: 'success', text: 'Prompt template deleted' })
      setConfirm(null)
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const startEdit = (p: PromptTemplate) => {
    setEditing(p.id)
    setForm({ ...p, is_active: Boolean(p.is_active) })
    setShowForm(true)
  }

  const filtered = search
    ? prompts.filter((p) =>
        p.template_key.toLowerCase().includes(search.toLowerCase()) ||
        p.template_text.toLowerCase().includes(search.toLowerCase())
      )
    : prompts

  if (loading && prompts.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="space-y-4">
      <Toast message={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Delete Prompt Template"
        message="Are you sure you want to delete this prompt template? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={deletePrompt}
        onCancel={() => setConfirm(null)}
      />

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Prompt Templates</h1>
        <p className="text-sm text-gray-500">Manage AI prompt templates</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-9 w-44"
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 w-36"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Agents</option>
            {agentTypes.map((a) => <option key={a} value={a}>{a}</option>)}
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
          onClick={() => { setEditing(null); setShowForm(true); setForm({ agent_type: 'internship', template_key: '', template_text: '', is_active: true }) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Prompt
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Agent Type *</label>
              <select
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.agent_type}
                onChange={(e) => setForm({ ...form, agent_type: e.target.value })}
              >
                {agentTypes.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Template Key *</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.template_key}
                onChange={(e) => setForm({ ...form, template_key: e.target.value })}
                placeholder="e.g., greeting, confirmation"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Template Text *</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-40 font-mono"
              value={form.template_text}
              onChange={(e) => setForm({ ...form, template_text: e.target.value })}
              placeholder="Template with {variable} placeholders..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="prompt-active"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
            />
            <label htmlFor="prompt-active" className="text-sm font-medium text-gray-700">Active</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={savePrompt}
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
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">{search ? 'No prompts match your search.' : 'No prompt templates yet. Click "Add Prompt" to create one.'}</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <FileText className="w-5 h-5 text-purple-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600">{p.agent_type}</span>
                  <span className="text-sm font-semibold text-gray-900 truncate">{p.template_key}</span>
                  {p.is_active ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => setConfirm({ id: p.id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">{p.template_text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
