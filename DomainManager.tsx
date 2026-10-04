import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Save, X, RefreshCw, ChevronDown, ChevronUp, Layers, Search } from 'lucide-react'
import { api } from '../../api/client'
import type { InternshipDomain, DomainBatch } from '../../types'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import Toast from '../../components/admin/Toast'

export default function DomainManager() {
  const [domains, setDomains] = useState<InternshipDomain[]>([])
  const [batches, setBatches] = useState<Record<number, DomainBatch[]>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<any>({ name: '', description: '', duration_options: '', eligibility: '', skills_learned: '', career_prospects: '', fee_structure: '', prerequisites: '', tools_covered: '', project_details: '', certification_details: '', mode: 'online', is_active: true, sort_order: 0 })
  const [batchForm, setBatchForm] = useState<Record<number, any>>({})
  const [editingBatch, setEditingBatch] = useState<{ domainId: number; batch: DomainBatch } | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ type: 'domain' | 'batch'; id: number; domainId?: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.admin.listDomains()
      setDomains(data)
      const b: Record<number, DomainBatch[]> = {}
      for (const d of data) {
        try { b[d.id] = await api.admin.listDomainBatches(d.id) } catch { b[d.id] = [] }
      }
      setBatches(b)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveDomain = async () => {
    if (!form.name) {
      setToast({ type: 'error', text: 'Domain name is required' })
      return
    }
    try {
      if (editing) {
        await api.admin.updateDomain(editing, form)
        setToast({ type: 'success', text: 'Domain updated' })
      } else {
        await api.admin.createDomain(form)
        setToast({ type: 'success', text: 'Domain created' })
      }
      setShowForm(false)
      setEditing(null)
      setForm({ name: '', description: '', duration_options: '', eligibility: '', skills_learned: '', career_prospects: '', fee_structure: '', prerequisites: '', tools_covered: '', project_details: '', certification_details: '', mode: 'online', is_active: true, sort_order: 0 })
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const deleteDomain = async () => {
    if (!confirm || confirm.type !== 'domain') return
    try {
      await api.admin.deleteDomain(confirm.id)
      setToast({ type: 'success', text: 'Domain deleted' })
      setConfirm(null)
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const startEdit = (d: InternshipDomain) => {
    setEditing(d.id)
    setForm({ ...d, is_active: Boolean(d.is_active) })
    setShowForm(true)
  }

  const saveBatch = async (domainId: number) => {
    const bf = batchForm[domainId]
    if (!bf || !bf.batch_name) return
    try {
      await api.admin.createDomainBatch(domainId, bf)
      setBatchForm({ ...batchForm, [domainId]: { batch_name: '', start_date: '', end_date: '', capacity: 30, schedule: '' } })
      setToast({ type: 'success', text: 'Batch added' })
      const updated = await api.admin.listDomainBatches(domainId)
      setBatches({ ...batches, [domainId]: updated })
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const startEditBatch = (domainId: number, batch: DomainBatch) => {
    setEditingBatch({ domainId, batch })
    setBatchForm({ ...batchForm, [domainId]: { batch_name: batch.batch_name, start_date: batch.start_date || '', end_date: batch.end_date || '', capacity: batch.capacity, schedule: batch.schedule || '' } })
  }

  const saveEditBatch = async () => {
    if (!editingBatch) return
    const { domainId, batch } = editingBatch
    const bf = batchForm[domainId]
    if (!bf || !bf.batch_name) return
    try {
      await api.admin.updateBatch(batch.id, bf)
      setToast({ type: 'success', text: 'Batch updated' })
      setEditingBatch(null)
      const updated = await api.admin.listDomainBatches(domainId)
      setBatches({ ...batches, [domainId]: updated })
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const deleteBatch = async () => {
    if (!confirm || confirm.type !== 'batch' || !confirm.domainId) return
    try {
      await api.admin.deleteBatch(confirm.id)
      setToast({ type: 'success', text: 'Batch deleted' })
      const updated = await api.admin.listDomainBatches(confirm.domainId)
      setBatches({ ...batches, [confirm.domainId]: updated })
      setConfirm(null)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const filtered = search
    ? domains.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || (d.description || '').toLowerCase().includes(search.toLowerCase()))
    : domains

  if (loading && domains.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="space-y-4">
      <Toast message={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirm?.type === 'domain'}
        title="Delete Domain"
        message="Are you sure you want to delete this domain? All associated batches will also be removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteDomain}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.type === 'batch'}
        title="Delete Batch"
        message="Are you sure you want to delete this batch? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteBatch}
        onCancel={() => setConfirm(null)}
      />

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Domain Manager</h1>
        <p className="text-sm text-gray-500">Manage internship domains and batches</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-9 w-44"
              placeholder="Search domains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); setForm({ name: '', description: '', duration_options: '', eligibility: '', skills_learned: '', career_prospects: '', fee_structure: '', prerequisites: '', tools_covered: '', project_details: '', certification_details: '', mode: 'online', is_active: true, sort_order: 0 }) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Domain
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Domain Name *</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., AI/ML"
              />
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
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-20"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Duration Options</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.duration_options || ''}
                onChange={(e) => setForm({ ...form, duration_options: e.target.value })}
                placeholder="e.g., 1, 3, 6 months"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Fee Structure</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.fee_structure || ''}
                onChange={(e) => setForm({ ...form, fee_structure: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Mode</label>
              <select
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150"
                value={form.mode || 'online'}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Eligibility</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-16"
              value={form.eligibility || ''}
              onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Prerequisites</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-16"
              value={form.prerequisites || ''}
              onChange={(e) => setForm({ ...form, prerequisites: e.target.value })}
              placeholder="What students need to know before joining"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Skills Learned</label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-16"
                value={form.skills_learned || ''}
                onChange={(e) => setForm({ ...form, skills_learned: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Tools Covered</label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-16"
                value={form.tools_covered || ''}
                onChange={(e) => setForm({ ...form, tools_covered: e.target.value })}
                placeholder="e.g., Python, TensorFlow, SQL"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Career Prospects</label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-16"
                value={form.career_prospects || ''}
                onChange={(e) => setForm({ ...form, career_prospects: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Project Details</label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-16"
                value={form.project_details || ''}
                onChange={(e) => setForm({ ...form, project_details: e.target.value })}
                placeholder="Real-world projects students will work on"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Certification Details</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 resize-none h-16"
              value={form.certification_details || ''}
              onChange={(e) => setForm({ ...form, certification_details: e.target.value })}
              placeholder="Certificate info, issuing authority, etc."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="domain-active"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
            />
            <label htmlFor="domain-active" className="text-sm font-medium text-gray-700">Active</label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={saveDomain}
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
          <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">{search ? 'No domains match your search.' : 'No domains configured yet. Click "Add Domain" to create one.'}</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((d) => (
          <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <Layers className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-semibold text-gray-900 truncate">{d.name}</span>
                {d.is_active ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">sort: {d.sort_order}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpanded({ ...expanded, [d.id]: !expanded[d.id] })}
                  className="px-2 py-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-150 inline-flex items-center gap-1 text-xs font-medium"
                >
                  {expanded[d.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Batches
                </button>
                <button onClick={() => startEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => setConfirm({ type: 'domain', id: d.id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {d.description && <p className="text-sm text-gray-600 mb-4">{d.description}</p>}
            {expanded[d.id] && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 flex-1"
                    placeholder="Batch name"
                    value={batchForm[d.id]?.batch_name || ''}
                    onChange={(e) => setBatchForm({ ...batchForm, [d.id]: { ...batchForm[d.id], batch_name: e.target.value } })}
                  />
                  <input
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 w-32"
                    placeholder="Schedule"
                    value={batchForm[d.id]?.schedule || ''}
                    onChange={(e) => setBatchForm({ ...batchForm, [d.id]: { ...batchForm[d.id], schedule: e.target.value } })}
                  />
                  <input
                    type="number"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 w-20"
                    placeholder="Cap"
                    value={batchForm[d.id]?.capacity || 30}
                    onChange={(e) => setBatchForm({ ...batchForm, [d.id]: { ...batchForm[d.id], capacity: parseInt(e.target.value) || 30 } })}
                  />
                  <button
                    onClick={() => saveBatch(d.id)}
                    className="px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1 shadow-sm"
                    title="Add batch"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {(batches[d.id] || []).map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5 px-3.5 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{b.batch_name}</span>
                      <span className="text-gray-500">{b.schedule || 'TBD'}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {b.occupied}/{b.capacity} filled
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {editingBatch?.domainId === d.id && editingBatch?.batch.id === b.id ? (
                        <>
                          <button onClick={saveEditBatch} className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-all duration-150"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setEditingBatch(null); setBatchForm({ ...batchForm, [d.id]: { batch_name: '', start_date: '', end_date: '', capacity: 30, schedule: '' } }) }} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-150"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditBatch(d.id, b)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setConfirm({ type: 'batch', id: b.id, domainId: d.id })} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
