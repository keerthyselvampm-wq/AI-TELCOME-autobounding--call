import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ClipboardList, Search, Filter } from 'lucide-react'
import { api } from '../../api/client'
import type { AuditLog } from '../../types'
import Toast from '../../components/admin/Toast'

const entityTypes = ['agent_config', 'internship_domain', 'domain_batch', 'knowledge_base', 'prompt_template', 'faq_entry', 'business_hours', 'holiday_schedule']

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.admin.listAuditLogs(filter || undefined, 100)
      setLogs(data)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? logs.filter((l) =>
        l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        (l.performed_by || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
  }

  if (loading && logs.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  return (
    <div className="space-y-6">
      <Toast message={toast} onClose={() => setToast(null)} />

      <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
      <p className="text-sm text-gray-500 mb-6">Track all changes made to the system</p>

      <div className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input className="w-48 px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-8" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <select className="w-40 px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 pl-8" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All Types</option>
              {entityTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <button onClick={load} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-150 border border-gray-200" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm text-gray-500">{search ? 'No logs match your search.' : 'No audit logs recorded yet.'}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((log) => (
          <div key={log.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all duration-150 cursor-pointer" onClick={() => setExpanded({ ...expanded, [log.id]: !expanded[log.id] })}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  log.action === 'created' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                  log.action === 'updated' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20' :
                  log.action === 'deleted' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                  'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
                }`}>{log.action}</span>
                <span className="text-sm font-medium text-gray-900 truncate">{log.entity_type.replace(/_/g, ' ')}</span>
                {log.entity_id && <span className="text-xs text-gray-400">#{log.entity_id}</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3 text-xs">
                <span className="text-gray-400">{formatTimestamp(log.timestamp)}</span>
                {log.performed_by && <span className="text-gray-500 font-medium">by {log.performed_by}</span>}
              </div>
            </div>
            {expanded[log.id] && log.changes && (
              <pre className="text-xs text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-40 border border-gray-100">{JSON.stringify(log.changes, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
