import { useEffect, useState } from 'react'
import { Plus, Download, Filter, Pencil, Trash2, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import type { Student, StudentFilter, AIAddStudentResponse } from '../types'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  joined: 'bg-blue-100 text-blue-800',
  follow_up: 'bg-orange-100 text-orange-800',
}

const docStatusColors: Record<string, string> = {
  not_submitted: 'bg-red-100 text-red-800',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-orange-100 text-orange-800',
}

const batchLabels: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

const emptyForm = {
  name: '', college: '', domain: '', contact_number: '',
  joining_date: '', duration: '3 months', batch: 'morning',
  status: 'pending', document_status: 'not_submitted',
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<StudentFilter>({})
  const [showFilters, setShowFilters] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [showAiInput, setShowAiInput] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AIAddStudentResponse | null>(null)
  const [aiError, setAiError] = useState('')

  const fetchStudents = () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (filters.name) params.name = filters.name
    if (filters.college) params.college = filters.college
    if (filters.domain) params.domain = filters.domain
    if (filters.batch) params.batch = filters.batch
    if (filters.status) params.status = filters.status
    if (filters.document_status) params.document_status = filters.document_status

    api.students.list(params).then(setStudents).finally(() => setLoading(false))
  }

  useEffect(() => { fetchStudents() }, [filters])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setFormError('')
    setFormSuccess('')
    setShowForm(true)
  }

  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({
      name: s.name,
      college: s.college,
      domain: s.domain,
      contact_number: s.contact_number,
      joining_date: s.joining_date.split('T')[0],
      duration: s.duration,
      batch: s.batch,
      status: s.status,
      document_status: s.document_status,
    })
    setFormError('')
    setFormSuccess('')
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    setFormSuccess('')
    try {
      if (editing) {
        await api.students.update(editing.id, form)
        setFormSuccess('Student updated successfully')
      } else {
        await api.students.create(form)
        setFormSuccess('Student added successfully')
        setForm({ ...emptyForm })
      }
      fetchStudents()
      setTimeout(() => setShowForm(false), 1000)
    } catch (err: any) {
      setFormError(err.message || 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  const handleAiSubmit = async () => {
    if (!aiInput.trim()) return
    setAiLoading(true)
    setAiError('')
    setAiResult(null)
    try {
      const result = await api.students.aiAdd({ text: aiInput })
      setAiResult(result)
      setAiInput('')
      fetchStudents()
    } catch (err: any) {
      setAiError(err.message || 'AI request failed')
    } finally {
      setAiLoading(false)
    }
  }

  const handleDelete = async (s: Student) => {
    if (!window.confirm(`Delete student "${s.name}"? This cannot be undone.`)) return
    try {
      await api.students.delete(s.id)
      fetchStudents()
    } catch (err: any) {
      alert(err.message || 'Failed to delete student')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500">Manage internship registrations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
          <button onClick={openAdd} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Student
          </button>
          <button onClick={() => api.students.exportCsv()} className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setShowAiInput(!showAiInput); setAiResult(null); setAiError('') }}
            className={`px-3 py-1.5 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 flex items-center gap-2 ${showAiInput ? 'ring-2 ring-blue-400' : ''}`}>
            <Sparkles className="w-4 h-4" /> AI Add
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name"
            value={filters.name || ''}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="College"
            value={filters.college || ''}
            onChange={(e) => setFilters({ ...filters, college: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Domain"
            value={filters.domain || ''}
            onChange={(e) => setFilters({ ...filters, domain: e.target.value })}
          />
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.batch || ''}
            onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
          >
            <option value="">All Batches</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="joined">Joined</option>
            <option value="follow_up">Follow Up</option>
          </select>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.document_status || ''}
            onChange={(e) => setFilters({ ...filters, document_status: e.target.value || undefined })}
          >
            <option value="">All Documents</option>
            <option value="not_submitted">Not Submitted</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      )}

      {showAiInput && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">AI Student Assistant</h3>
          </div>
          <p className="text-sm text-blue-700 mb-3">
            Describe the student in natural language and I'll add or update them automatically.
          </p>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder='e.g. "Add John Doe from MIT for AI Engineering, joining next Monday, morning batch, contact 9999999999"'
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
          />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={handleAiSubmit} disabled={aiLoading || !aiInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {aiLoading ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Processing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Process</>
              )}
            </button>
            <button onClick={() => { setShowAiInput(false); setAiResult(null); setAiError('') }}
              className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50">Close</button>
          </div>

          {aiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm mt-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {aiError}
            </div>
          )}

          {aiResult && (
            <div className="mt-3 p-3 rounded-lg bg-green-50 text-green-800 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Student {aiResult.action} successfully!
              </div>
              <div className="text-green-700">Name: <strong>{aiResult.student.name}</strong></div>
              {aiResult.student.domain && <div className="text-green-700">Domain: {aiResult.student.domain}</div>}
              {aiResult.student.college && <div className="text-green-700">College: {aiResult.student.college}</div>}
              {aiResult.student.contact_number && <div className="text-green-700">Contact: {aiResult.student.contact_number}</div>}
              {aiResult.student.batch && <div className="text-green-700">Batch: {aiResult.student.batch}</div>}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Student' : 'Add Student'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">College</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required value={form.college} onChange={e => setForm({ ...form, college: e.target.value })} placeholder="University name" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="AI Engineering, Data Science, etc." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} placeholder="+919999999999" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}>
                    <option value="1 month">1 Month</option>
                    <option value="3 months">3 Months</option>
                    <option value="6 months">6 Months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })}>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="joined">Joined</option>
                    <option value="follow_up">Follow Up</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Status</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.document_status} onChange={e => setForm({ ...form, document_status: e.target.value })}>
                    <option value="not_submitted">Not Submitted</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {formSuccess}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {saving ? 'Saving...' : editing ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">College</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Domain</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Contact</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Joining Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Batch</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Documents</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Follow-Up</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-400">Loading...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-400">No students found</td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{student.name}</td>
                    <td className="py-3 px-4 text-gray-600">{student.college}</td>
                    <td className="py-3 px-4 text-gray-600">{student.domain}</td>
                    <td className="py-3 px-4 text-gray-600">{student.contact_number}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(student.joining_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium text-gray-600">{batchLabels[student.batch]}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[student.status]}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${docStatusColors[student.document_status]}`}>
                        {student.document_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {(student as any).missed_joining_reason ? (
                        <div className="text-xs space-y-0.5 max-w-[200px]">
                          <p className="text-gray-500 truncate" title={(student as any).missed_joining_reason}>
                            {(student as any).missed_joining_reason}
                          </p>
                          {((student as any).rescheduled_date || (student as any).rescheduled_batch) && (
                            <p className="text-blue-600 font-medium">
                              {(student as any).rescheduled_date ? new Date((student as any).rescheduled_date).toLocaleDateString() : ''}
                              {(student as any).rescheduled_batch ? ` (${(student as any).rescheduled_batch})` : ''}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(student)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(student)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
