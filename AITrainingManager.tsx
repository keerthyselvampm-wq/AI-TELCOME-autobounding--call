import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Save, X, RefreshCw, Brain, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../api/client'
import type { AITrainingContent } from '../../types'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import Toast from '../../components/admin/Toast'

const categories = ['prerequisites', 'syllabus', 'projects', 'certification', 'tools', 'faq_override', 'general', 'process']
const priorities = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'High' },
  { value: 2, label: 'Critical' },
]

export default function AITrainingManager() {
  const [entries, setEntries] = useState<AITrainingContent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [form, setForm] = useState<any>({ agent_type: 'internship', topic: '', content: '', category: '', priority: 0, config_metadata: null, is_active: true })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ id: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.admin.listTraining('internship', filter || undefined)
      setEntries(data)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const saveEntry = async () => {
    if (!form.topic || !form.content) {
      setToast({ type: 'error', text: 'Topic and Content are required' })
      return
    }
    try {
      if (editing) {
        await api.admin.updateTraining(editing, form)
        setToast({ type: 'success', text: 'Training content updated' })
      } else {
        await api.admin.createTraining(form)
        setToast({ type: 'success', text: 'Training content created' })
      }
      setShowForm(false)
      setEditing(null)
      setForm({ agent_type: 'internship', topic: '', content: '', category: '', priority: 0, config_metadata: null, is_active: true })
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const deleteEntry = async () => {
    if (!confirm) return
    try {
      await api.admin.deleteTraining(confirm.id)
      setToast({ type: 'success', text: 'Training content deleted' })
      setConfirm(null)
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const startEdit = (e: AITrainingContent) => {
    setEditing(e.id)
    setForm({ ...e, is_active: Boolean(e.is_active) })
    setShowForm(true)
  }

  const filtered = search
    ? entries.filter((e) =>
        e.topic.toLowerCase().includes(search.toLowerCase()) ||
        e.content.toLowerCase().includes(search.toLowerCase()) ||
        (e.category || '').toLowerCase().includes(search.toLowerCase())
      )
    : entries

  if (loading && entries.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="space-y-6">
      <Toast message={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Delete Training Content"
        message="Are you sure you want to delete this training content? The AI will no longer have access to this information."
        confirmLabel="Delete"
        onConfirm={deleteEntry}
        onCancel={() => setConfirm(null)}
      />

      <h1 className="text-2xl font-bold text-gray-900">AI Training Content</h1>
      <p className="text-sm text-gray-500 mb-6">Manage training content for the AI assistant</p>

      <div className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="w-48 px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-8" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <select className="w-40 px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-8" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <button onClick={load} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-150 border border-gray-200" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); setForm({ agent_type: 'internship', topic: '', content: '', category: '', priority: 0, config_metadata: null, is_active: true }) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" /> Add Training
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 border-l-4 border-l-blue-500">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Topic *</label>
              <input className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g., Prerequisites, Syllabus" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Category</label>
              <select className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">General</option>
                {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Priority</label>
              <select className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}>
                {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Content *</label>
            <p className="text-xs text-gray-400 mb-1.5">This content will be injected into the AI's system prompt for training context.</p>
            <textarea className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 h-40 resize-none font-mono" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Enter the training content that the AI should know..." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="training-active" checked={Boolean(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
            <label htmlFor="training-active" className="text-sm text-gray-700">Active (visible to AI)</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={saveEntry} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm"><Save className="w-4 h-4" /> {editing ? 'Update' : 'Create'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5"><X className="w-4 h-4" /> Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">{search ? 'No training content matches your search.' : 'No AI training content yet. Click "Add Training" to teach the AI about internship details.'}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((e) => (
          <div key={e.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Brain className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    e.priority >= 2 ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                    e.priority >= 1 ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' :
                    'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
                  }`}>
                    {priorities.find((p) => p.value === e.priority)?.label || 'Normal'}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">{e.topic}</span>
                  {e.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      {e.category.replace(/_/g, ' ')}
                    </span>
                  )}
                  {!e.is_active && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-600/20">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0 ml-2">
                <button onClick={() => setExpanded({ ...expanded, [e.id]: !expanded[e.id] })} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-150">
                  {expanded[e.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={() => startEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirm({ id: e.id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {expanded[e.id] && (
              <pre className="text-xs text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-60 whitespace-pre-wrap border border-gray-100">{e.content}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
