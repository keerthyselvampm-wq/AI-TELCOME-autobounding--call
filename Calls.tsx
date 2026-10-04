import { useEffect, useState } from 'react'
import { Phone, PhoneIncoming, PhoneOutgoing, Headphones } from 'lucide-react'
import { api } from '../api/client'
import type { CallLog } from '../types'

const outcomeColors: Record<string, string> = {
  answered: 'text-green-600 bg-green-50',
  not_answered: 'text-red-600 bg-red-50',
  busy: 'text-yellow-600 bg-yellow-50',
  call_back: 'text-blue-600 bg-blue-50',
  confirmed: 'text-emerald-600 bg-emerald-50',
  cancelled: 'text-gray-600 bg-gray-50',
}

export default function Calls() {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)

  useEffect(() => {
    api.calls.list().then(setCalls).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Call Logs</h1>
        <p className="text-sm text-gray-500">View all inbound and outbound call records</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Student</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Outcome</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Language</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td>
                  </tr>
                ) : calls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">No call logs found</td>
                  </tr>
                ) : (
                  calls.map((call) => (
                    <tr
                      key={call.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedCall(call)}
                    >
                      <td className="py-3 px-4">
                        {call.call_type === 'inbound' ? (
                          <span className="flex items-center gap-1.5 text-blue-600">
                            <PhoneIncoming className="w-4 h-4" /> Inbound
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-orange-600">
                            <PhoneOutgoing className="w-4 h-4" /> Outbound
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{call.student_id || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{new Date(call.timestamp).toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-600">{call.duration}s</td>
                      <td className="py-3 px-4">
                        {call.outcome && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${outcomeColors[call.outcome]}`}>
                            {call.outcome.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 capitalize">{call.language}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Call Details</h2>
          {selectedCall ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500">Transcript</p>
                <p className="text-sm text-gray-700 mt-1">{selectedCall.transcript || 'No transcript available'}</p>
              </div>
              {selectedCall.recording_url && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Recording</p>
                  <audio controls className="w-full" src={selectedCall.recording_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
              {selectedCall.ai_summary && (
                <div>
                  <p className="text-xs text-gray-500">AI Summary</p>
                  <p className="text-sm text-gray-700 mt-1">{selectedCall.ai_summary}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Headphones className="w-12 h-12 mb-3" />
              <p className="text-sm">Select a call to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
