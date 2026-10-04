import { useEffect, useState } from 'react'
import { Plus, CalendarDays, Users, Layers, X, Edit2, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/client'
import type { Slot, InternshipDomain, SlotDomainAllocation } from '../types'

const batchColors: Record<string, string> = {
  morning: 'bg-yellow-100 text-yellow-800',
  afternoon: 'bg-orange-100 text-orange-800',
  evening: 'bg-blue-100 text-blue-800',
}

const inputClass = 'w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150'

export default function Slots() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [domains, setDomains] = useState<InternshipDomain[]>([])
  const [allocations, setAllocations] = useState<Record<number, SlotDomainAllocation[]>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [form, setForm] = useState({ date: '', batch: 'morning', capacity: '30' })
  const [allocForm, setAllocForm] = useState<Record<number, { domain_id: string; max_capacity: string }>>({})
  const [editingAlloc, setEditingAlloc] = useState<{ slotId: number; allocId: number; maxCapacity: number } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchSlots = async () => {
    setLoading(true)
    try {
      const data = await api.slots.list()
      setSlots(data)
    } finally {
      setLoading(false)
    }
  }

  const loadAllocations = async (slotId: number) => {
    try {
      const data = await api.slots.listAllocations(slotId)
      setAllocations((prev) => ({ ...prev, [slotId]: data }))
    } catch {
      setAllocations((prev) => ({ ...prev, [slotId]: [] }))
    }
  }

  useEffect(() => {
    api.admin.listDomains().then(setDomains).catch(() => {})
    fetchSlots()
  }, [])

  const handleCreate = async () => {
    try {
      await api.slots.create({
        date: form.date,
        batch: form.batch,
        capacity: parseInt(form.capacity, 10) || 30,
      })
      setShowCreate(false)
      setForm({ date: '', batch: 'morning', capacity: '30' })
      setMessage({ type: 'success', text: 'Slot created' })
      fetchSlots()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const toggleExpand = async (slotId: number) => {
    const willExpand = !expanded[slotId]
    setExpanded((prev) => ({ ...prev, [slotId]: willExpand }))
    if (willExpand && !allocations[slotId]) {
      await loadAllocations(slotId)
    }
  }

  const addAllocation = async (slotId: number) => {
    const af = allocForm[slotId]
    if (!af || !af.domain_id || !af.max_capacity) return
    try {
      await api.slots.createAllocation(slotId, {
        domain_id: parseInt(af.domain_id, 10),
        max_capacity: parseInt(af.max_capacity, 10),
      })
      setAllocForm((prev) => ({ ...prev, [slotId]: { domain_id: '', max_capacity: '' } }))
      setMessage({ type: 'success', text: 'Domain allocation added' })
      await loadAllocations(slotId)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const startEditAlloc = (slotId: number, alloc: SlotDomainAllocation) => {
    setEditingAlloc({ slotId, allocId: alloc.id, maxCapacity: alloc.max_capacity })
  }

  const saveEditAlloc = async () => {
    if (!editingAlloc) return
    try {
      await api.slots.updateAllocation(editingAlloc.allocId, { max_capacity: editingAlloc.maxCapacity })
      setMessage({ type: 'success', text: 'Allocation updated' })
      setEditingAlloc(null)
      await loadAllocations(editingAlloc.slotId)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const deleteAllocation = async (slotId: number, allocationId: number) => {
    if (!confirm('Remove this domain allocation?')) return
    try {
      await api.slots.deleteAllocation(allocationId)
      setMessage({ type: 'success', text: 'Domain allocation removed' })
      await loadAllocations(slotId)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const usedDomains = (slotId: number) => {
    return (allocations[slotId] || []).map((a) => a.domain_id)
  }

  const totalSlots = slots.length
  const totalCapacity = slots.reduce((s, sl) => s + sl.capacity, 0)
  const totalOccupied = slots.reduce((s, sl) => s + sl.occupied, 0)

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center justify-between ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-current opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Slot Management</h1>
          <p className="text-sm text-gray-500">Manage batches with per-domain capacity allocations</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 flex items-center gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> Add Slot
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><CalendarDays className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Total Slots</p><p className="text-lg font-bold text-gray-900">{totalSlots}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50"><Users className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-xs text-gray-500">Total Capacity</p><p className="text-lg font-bold text-gray-900">{totalCapacity}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><Users className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-gray-500">Total Occupied</p><p className="text-lg font-bold text-gray-900">{totalOccupied}</p></div>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 border-l-4 border-l-blue-500">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Create New Slot</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Date</label>
              <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Batch</label>
              <select className={inputClass} value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Total Capacity</label>
              <input type="number" className={inputClass} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 shadow-sm">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm text-gray-500">No slots configured yet. Click "Add Slot" to create one.</p>
          </div>
        ) : (
          slots.map((slot) => {
            const slotAllocs = allocations[slot.id] || []
            const totalAllocMax = slotAllocs.reduce((s, a) => s + a.max_capacity, 0)
            const totalAllocOcc = slotAllocs.reduce((s, a) => s + a.occupied, 0)
            const usagePct = slot.capacity > 0 ? (slot.occupied / slot.capacity) * 100 : 0

            return (
              <div key={slot.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${batchColors[slot.batch]}`}>
                        {slot.batch}
                      </span>
                      <span className="text-sm text-gray-500">{new Date(slot.date).toLocaleDateString()}</span>
                      <span className="text-sm font-semibold text-gray-900">{slot.occupied}/{slot.capacity}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        slot.available > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {slot.available} available
                      </span>
                    </div>
                    <button onClick={() => toggleExpand(slot.id)} className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {expanded[slot.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span className="ml-0.5">Domains ({slotAllocs.length})</span>
                    </button>
                  </div>

                  <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                </div>

                {expanded[slot.id] && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <select
                        className={inputClass + ' flex-1'}
                        value={allocForm[slot.id]?.domain_id || ''}
                        onChange={(e) => setAllocForm((prev) => ({ ...prev, [slot.id]: { ...prev[slot.id], domain_id: e.target.value } }))}
                      >
                        <option value="">Select domain...</option>
                        {domains.filter((d) => !usedDomains(slot.id).includes(d.id)).map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className={inputClass + ' w-28'}
                        placeholder="Max seats"
                        value={allocForm[slot.id]?.max_capacity || ''}
                        onChange={(e) => setAllocForm((prev) => ({ ...prev, [slot.id]: { ...prev[slot.id], max_capacity: e.target.value } }))}
                      />
                      <button onClick={() => addAllocation(slot.id)} className="px-3 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 shadow-sm">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {totalAllocMax > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                        <Users className="w-3.5 h-3.5" />
                        Domain allocations: {totalAllocOcc}/{totalAllocMax} &middot; Slot capacity: {slot.capacity}
                      </div>
                    )}

                    {slotAllocs.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">No domain allocations yet. Add one above.</p>
                    ) : (
                      <div className="space-y-2">
                        {slotAllocs.map((a) => {
                          const allocUsage = a.max_capacity > 0 ? (a.occupied / a.max_capacity) * 100 : 0
                          const isEditing = editingAlloc?.slotId === slot.id && editingAlloc?.allocId === a.id

                          return (
                            <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 hover:bg-gray-100/50 transition-colors duration-150">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="p-1.5 rounded-md bg-white"><Layers className="w-4 h-4 text-blue-600" /></div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{a.domain_name || `Domain #${a.domain_id}`}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {isEditing ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          className="w-20 px-2 py-1 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          value={editingAlloc.maxCapacity}
                                          onChange={(e) => setEditingAlloc({ ...editingAlloc, maxCapacity: parseInt(e.target.value) || 0 })}
                                          min={a.occupied}
                                        />
                                        <button onClick={saveEditAlloc} className="p-1 text-green-600 hover:text-green-800"><Save className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setEditingAlloc(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-xs text-gray-500">{a.occupied}/{a.max_capacity} filled</span>
                                        <span className={`text-xs font-medium ${a.available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {a.available} left
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-20 bg-gray-200 rounded-full h-1.5 hidden sm:block">
                                  <div
                                    className={`h-1.5 rounded-full ${allocUsage > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${allocUsage}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => startEditAlloc(slot.id, a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => deleteAllocation(slot.id, a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
