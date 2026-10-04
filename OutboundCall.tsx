import { useEffect, useState, useCallback } from 'react'
import { Phone, PhoneOutgoing, CheckCircle2, AlertCircle, Loader2, Users, FileWarning, Play, Globe } from 'lucide-react'
import { api } from '../api/client'
import type { CallLog, PendingFollowupSegment, PendingFollowupStudent, BulkCallResponse } from '../types'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  joined: 'bg-blue-100 text-blue-700',
  follow_up: 'bg-orange-100 text-orange-700',
}

const batchLabels: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

type CallingState = 'idle' | 'calling' | 'done'

export default function OutboundCall() {
  const [toNumber, setToNumber] = useState('')
  const [calling, setCalling] = useState(false)
  const [result, setResult] = useState<{ call_sid: string; status: string } | null>(null)
  const [error, setError] = useState('')
  const [segments, setSegments] = useState<PendingFollowupSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set())
  const [callingState, setCallingState] = useState<CallingState>('idle')
  const [bulkResults, setBulkResults] = useState<BulkCallResponse | null>(null)
  const [outboundCalls, setOutboundCalls] = useState<CallLog[]>([])
  const [diagnostics, setDiagnostics] = useState<any>(null)

  const loadData = useCallback(async () => {
    try {
      const [diag, calls, followup] = await Promise.all([
        api.exotel.diagnostics().catch(() => null),
        api.calls.list({ call_type: 'outbound' }).catch(() => []),
        api.students.pendingFollowup().catch(() => []),
      ])
      setDiagnostics(diag)
      setOutboundCalls(calls)
      setSegments(followup)
      setSelectedSegment(followup[0]?.segment || null)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!toNumber.trim()) return
    setCalling(true); setResult(null); setError('')
    try {
      const res = await api.exotel.makeTestCall(toNumber.trim())
      setResult(res); setToNumber(''); loadData()
    } catch (err: any) {
      setError(err.message || 'Call failed')
    } finally { setCalling(false) }
  }

  const currentSegment = segments.find(s => s.segment === selectedSegment)
  const allSelected = currentSegment && selectedStudents.size === currentSegment.students.length

  const toggleAll = () => {
    if (!currentSegment) return
    setSelectedStudents(allSelected ? new Set() : new Set(currentSegment.students.map(s => s.id)))
  }

  const toggleStudent = (id: number) => {
    const next = new Set(selectedStudents)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedStudents(next)
  }

  const startBulkCall = async () => {
    if (selectedStudents.size === 0) return
    setCallingState('calling'); setBulkResults(null); setError('')
    const agentType = currentSegment?.segment === 'not_joined' ? 'missed_joining' : 'internship'
    try {
      const res = await api.exotel.bulkCall({ student_ids: Array.from(selectedStudents), agent_type: agentType, delay_seconds: 5 })
      setBulkResults(res); setCallingState('done'); setSelectedStudents(new Set()); loadData()
    } catch (err: any) {
      setError(err.message || 'Bulk call failed'); setCallingState('idle')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Outbound Call</h1>
        <p className="text-sm text-gray-500">Initiate calls via Exotel</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Main */}
        <div className="xl:col-span-2 space-y-5">
          {/* Manual Call */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Manual Call</h2>
            <form onSubmit={handleCall}>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={toNumber}
                  onChange={e => setToNumber(e.target.value)}
                  placeholder="+919999999999"
                  disabled={calling}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={calling || !toNumber.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOutgoing className="w-4 h-4" />}
                  {calling ? 'Calling...' : 'Call'}
                </button>
              </div>
            </form>
            {error && <p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
            {result && <p className="mt-2 text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />SID: {result.call_sid}</p>}
          </div>

          {/* Bulk Call */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Bulk Call</h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedSegment || ''}
                  onChange={e => { setSelectedSegment(e.target.value); setSelectedStudents(new Set()) }}
                   className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {segments.map(s => <option key={s.segment} value={s.segment}>{s.label} ({s.count})</option>)}
                </select>
                <button
                  onClick={startBulkCall}
                  disabled={selectedStudents.size === 0 || callingState === 'calling'}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {callingState === 'calling' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Call {selectedStudents.size > 0 && `(${selectedStudents.size})`}
                </button>
              </div>
            </div>

            {callingState === 'calling' && (
              <div className="mb-3 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Calling students...
              </div>
            )}

            {bulkResults && (
              <div className="mb-3 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {bulkResults.queued} of {bulkResults.total} queued
              </div>
            )}

            {currentSegment && currentSegment.students.length > 0 ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={!!allSelected} onChange={toggleAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    All ({currentSegment.students.length})
                  </label>
                  <span className="text-xs text-gray-400">{selectedStudents.size} selected</span>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {currentSegment.students.map(s => (
                    <div
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-sm ${
                        selectedStudents.has(s.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggleStudent(s.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900">{s.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[s.status]}`}>{s.status}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{s.college} &middot; {s.contact_number} &middot; {batchLabels[s.batch]}</p>
                      </div>
                      <span className="text-xs text-gray-400 italic shrink-0">{s.reason}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-sm text-gray-400"><FileWarning className="w-8 h-8 mx-auto mb-2 opacity-50" />No students in this segment</div>
            )}
          </div>

          {/* Recent Calls */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent Outbound Calls</h2>
            {outboundCalls.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400"><Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />No outbound calls yet</div>
            ) : (
              <div className="overflow-x-auto text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="py-2 pr-3 font-medium">SID</th>
                      <th className="py-2 pr-3 font-medium">Time</th>
                      <th className="py-2 pr-3 font-medium">Dur</th>
                      <th className="py-2 pr-3 font-medium">Outcome</th>
                      <th className="py-2 font-medium">Lang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outboundCalls.slice(0, 10).map(c => (
                      <tr key={c.id} className="border-b border-gray-100 text-gray-600">
                        <td className="py-2 pr-3"><code className="text-xs bg-gray-100 px-1 rounded">{c.call_sid?.slice(0, 16)}...</code></td>
                        <td className="py-2 pr-3 whitespace-nowrap">{new Date(c.timestamp).toLocaleDateString()}</td>
                        <td className="py-2 pr-3">{c.duration}s</td>
                        <td className="py-2 pr-3"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          c.outcome === 'confirmed' ? 'bg-green-100 text-green-700' :
                          c.outcome === 'answered' ? 'bg-blue-100 text-blue-700' :
                          c.outcome === 'cancelled' ? 'bg-red-100 text-red-700' :
                          c.outcome === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{c.outcome || 'pending'}</span></td>
                        <td className="py-2">{c.language}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-600" />Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Exotel</span>
                <span className={`font-medium flex items-center gap-1 ${diagnostics?.exotel_configured ? 'text-green-600' : 'text-red-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${diagnostics?.exotel_configured ? 'bg-green-500' : 'bg-red-500'}`} />
                  {diagnostics?.exotel_configured ? 'Ready' : 'Not configured'}
                </span>
              </div>
              <div><span className="text-gray-500">Caller ID</span><p className="text-gray-700 text-xs font-mono">{diagnostics?.exotel_caller_id || '—'}</p></div>
              <div><span className="text-gray-500">Webhook</span><p className="text-gray-700 text-xs font-mono break-all">{diagnostics?.exotel_webhook_url || '—'}</p></div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-600" />Segments</h2>
            <div className="space-y-1.5">
              {segments.map(s => (
                <div
                  key={s.segment}
                  onClick={() => { setSelectedSegment(s.segment); setSelectedStudents(new Set()) }}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                    selectedSegment === s.segment ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <span className="text-gray-700 font-medium">{s.label}</span>
                  <span className="text-lg font-bold text-gray-900">{s.count}</span>
                </div>
              ))}
              {segments.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No segments</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
