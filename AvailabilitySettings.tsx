import { useEffect, useState, useCallback } from 'react'
import { Save, Plus, Trash2, RefreshCw, Clock, CalendarDays, Edit2, X } from 'lucide-react'
import { api } from '../../api/client'
import type { BusinessHours, Holiday } from '../../types'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import Toast from '../../components/admin/Toast'

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function AvailabilitySettings() {
  const [hours, setHours] = useState<BusinessHours[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [holidayForm, setHolidayForm] = useState({ date: '', description: '', is_recurring_yearly: false })
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [editHolidayForm, setEditHolidayForm] = useState({ description: '', is_recurring_yearly: false })
  const [confirm, setConfirm] = useState<{ id: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [h, hol] = await Promise.all([
        api.admin.listBusinessHours(),
        api.admin.listHolidays(),
      ])
      setHours(h)
      setHolidays(hol)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleDay = async (entry: BusinessHours) => {
    try {
      await api.admin.updateBusinessHours(entry.id, { is_working_day: !entry.is_working_day })
      load()
      setToast({ type: 'success', text: 'Business hours updated' })
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const updateTime = async (entry: BusinessHours, field: 'open_time' | 'close_time', value: string) => {
    try {
      await api.admin.updateBusinessHours(entry.id, { [field]: value })
      setToast({ type: 'success', text: 'Time updated' })
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const addHoliday = async () => {
    if (!holidayForm.date) {
      setToast({ type: 'error', text: 'Date is required' })
      return
    }
    try {
      await api.admin.createHoliday(holidayForm)
      setHolidayForm({ date: '', description: '', is_recurring_yearly: false })
      setToast({ type: 'success', text: 'Holiday added' })
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const saveEditHoliday = async () => {
    if (!editingHoliday) return
    try {
      await api.admin.updateHoliday(editingHoliday.id, editHolidayForm)
      setToast({ type: 'success', text: 'Holiday updated' })
      setEditingHoliday(null)
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  const deleteHoliday = async () => {
    if (!confirm) return
    try {
      await api.admin.deleteHoliday(confirm.id)
      setToast({ type: 'success', text: 'Holiday removed' })
      setConfirm(null)
      load()
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  if (loading && hours.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="space-y-6">
      <Toast message={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Remove Holiday"
        message="Are you sure you want to remove this holiday? This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={deleteHoliday}
        onCancel={() => setConfirm(null)}
      />

      <h1 className="text-2xl font-bold text-gray-900">Availability Settings</h1>
      <p className="text-sm text-gray-500 mb-6">Configure business hours and holiday schedules</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Business Hours</h3>
          </div>
          <button onClick={load} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-150 border border-gray-200" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {hours.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No business hours configured.</p>
            </div>
          )}
          {hours.map((h) => (
            <div key={h.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all duration-150 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className={`font-medium text-sm w-24 ${h.is_working_day ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                  {dayNames[h.day_of_week] || h.day_of_week}
                </span>
                {h.is_working_day ? (
                  <div className="flex items-center gap-2">
                    <input type="time" className="w-28 px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={h.open_time.slice(0, 5)} onChange={(e) => updateTime(h, 'open_time', e.target.value)} />
                    <span className="text-gray-400 text-sm">to</span>
                    <input type="time" className="w-28 px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={h.close_time.slice(0, 5)} onChange={(e) => updateTime(h, 'close_time', e.target.value)} />
                  </div>
                ) : (
                  <span className="text-sm text-red-500 font-medium">Closed</span>
                )}
              </div>
              <button onClick={() => toggleDay(h)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 ${h.is_working_day ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                {h.is_working_day ? 'Mark Closed' : 'Mark Open'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Holiday Schedule</h3>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <input type="date" className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} />
            <input className="flex-[2] px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" placeholder="Description (e.g., Diwali)" value={holidayForm.description} onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })} />
            <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 px-2">
              <input type="checkbox" checked={holidayForm.is_recurring_yearly} onChange={(e) => setHolidayForm({ ...holidayForm, is_recurring_yearly: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
              Recurring
            </label>
            <button onClick={addHoliday} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm"><Plus className="w-4 h-4" /> Add</button>
          </div>
        </div>

        <div className="space-y-2">
          {holidays.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No holidays scheduled. Add one above.</p>
            </div>
          )}
          {holidays.map((h) => (
            <div key={h.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all duration-150">
              {editingHoliday?.id === h.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 w-28">{h.date}</span>
                  <input className="flex-1 px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" placeholder="Description" value={editHolidayForm.description} onChange={(e) => setEditHolidayForm({ ...editHolidayForm, description: e.target.value })} />
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0 px-2">
                    <input type="checkbox" checked={editHolidayForm.is_recurring_yearly} onChange={(e) => setEditHolidayForm({ ...editHolidayForm, is_recurring_yearly: e.target.checked })} className="rounded border-gray-300 text-blue-600" />
                    Recurring
                  </label>
                  <button onClick={saveEditHoliday} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150"><Save className="w-4 h-4" /></button>
                  <button onClick={() => setEditingHoliday(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all duration-150"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{h.date}</span>
                    <span className="text-sm text-gray-600">{h.description || 'Holiday'}</span>
                    {h.is_recurring_yearly && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">Recurring</span>}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => { setEditingHoliday(h); setEditHolidayForm({ description: h.description || '', is_recurring_yearly: h.is_recurring_yearly }) }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setConfirm({ id: h.id })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
