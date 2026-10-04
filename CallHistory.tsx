import { useEffect, useState } from 'react'
import { Search, Download, FileText, X, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { api } from '../api/client'

export default function CallHistory() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [ivrFilter, setIvrFilter] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [selectedCall, setSelectedCall] = useState<any>(null)
  const [transcript, setTranscript] = useState<any>(null)

  const fetchData = () => {
    setLoading(true)
    const params: Record<string, string> = { page: String(page) }
    if (search) params.search = search
    if (ivrFilter) params.ivr_option = ivrFilter
    if (outcomeFilter) params.outcome = outcomeFilter
    api.analytics.calls(params).then(setData).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [page, ivrFilter, outcomeFilter])

  const handleSearch = () => { setPage(1); fetchData() }

  const viewTranscript = async (id: number) => {
    const t = await api.analytics.transcript(id)
    setTranscript(t)
    setSelectedCall(data?.items.find((c: any) => c.id === id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Call History</h1>
          <p className="text-sm text-gray-500">Browse and search all call records</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search transcripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={ivrFilter} onChange={(e) => { setIvrFilter(e.target.value); setPage(1) }}>
            <option value="">All IVR Options</option>
            <option value="internship">Internship</option>
            <option value="hr">HR Support</option>
            <option value="general">General</option>
          </select>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={outcomeFilter} onChange={(e) => { setOutcomeFilter(e.target.value); setPage(1) }}>
            <option value="">All Outcomes</option>
            <option value="answered">Answered</option>
            <option value="not_answered">Not Answered</option>
            <option value="busy">Busy</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Search</button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Caller</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">IVR</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Agent</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Outcome</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No calls found</td></tr>
              ) : (
                data.items.map((call: any) => (
                  <tr key={call.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{call.caller_number || '-'}</td>
                    <td className="py-3 px-4">
                      {call.call_type === 'inbound' ? (
                        <span className="flex items-center gap-1 text-blue-600"><PhoneIncoming className="w-4 h-4" /> Inbound</span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-600"><PhoneOutgoing className="w-4 h-4" /> Outbound</span>
                      )}
                    </td>
                    <td className="py-3 px-4 capitalize text-gray-600">{call.ivr_option || '-'}</td>
                    <td className="py-3 px-4 capitalize text-gray-600">{call.agent_type || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{call.duration}s</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        call.outcome === 'answered' || call.outcome === 'confirmed' ? 'bg-green-50 text-green-600' :
                        call.outcome === 'cancelled' ? 'bg-red-50 text-red-600' :
                        call.outcome === 'busy' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {call.outcome?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{new Date(call.timestamp).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => viewTranscript(call.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="View Transcript"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => api.analytics.downloadTranscript(call.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Download Transcript"
                        >
                          <Download className="w-4 h-4" />
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

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Showing page {data.page} of {data.total_pages} ({data.total} total)</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button disabled={page >= data.total_pages} onClick={() => setPage(page + 1)}
              className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {transcript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setTranscript(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Call Transcript</h3>
              <button onClick={() => setTranscript(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div><span className="text-gray-500">Caller:</span> <span className="font-medium">{transcript.caller_number || 'N/A'}</span></div>
                <div><span className="text-gray-500">Duration:</span> <span className="font-medium">{transcript.duration}s</span></div>
                <div><span className="text-gray-500">IVR Option:</span> <span className="font-medium capitalize">{transcript.ivr_option || 'N/A'}</span></div>
                <div><span className="text-gray-500">Agent:</span> <span className="font-medium capitalize">{transcript.agent_type || 'N/A'}</span></div>
                <div><span className="text-gray-500">Outcome:</span> <span className="font-medium capitalize">{transcript.outcome?.replace('_', ' ') || 'N/A'}</span></div>
                <div><span className="text-gray-500">Time:</span> <span className="font-medium">{new Date(transcript.timestamp).toLocaleString()}</span></div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Conversation</h4>
                <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-gray-600 max-h-48 overflow-y-auto">
                  {transcript.transcript || 'No transcript available'}
                </div>
              </div>

              {transcript.ai_summary && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">AI Summary</h4>
                  <div className="p-4 bg-blue-50 rounded-lg text-gray-600">
                    {transcript.ai_summary}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => api.analytics.downloadTranscript(transcript.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
