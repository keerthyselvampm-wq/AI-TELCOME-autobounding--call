import { useEffect, useState } from 'react'
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, BarChart3, PieChart, TrendingUp } from 'lucide-react'
import { api } from '../api/client'

export default function CallAnalytics() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    api.analytics.summary(days).then(setSummary).finally(() => setLoading(false))
  }, [days])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Call Analytics</h1>
          <p className="text-sm text-gray-500">Detailed call metrics and performance</p>
        </div>
        <select
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={days}
          onChange={(e) => { setLoading(true); setDays(parseInt(e.target.value)) }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50"><Phone className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Total Calls</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_calls}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-50"><PhoneIncoming className="w-5 h-5 text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Inbound</p>
            <p className="text-2xl font-bold text-gray-900">{summary.inbound_calls}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-orange-50"><PhoneOutgoing className="w-5 h-5 text-orange-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Outbound</p>
            <p className="text-2xl font-bold text-gray-900">{summary.outbound_calls}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50"><Clock className="w-5 h-5 text-purple-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Avg Duration</p>
            <p className="text-2xl font-bold text-gray-900">{summary.avg_duration_seconds}s</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-600" /> IVR Option Distribution
          </h2>
          {Object.entries(summary.ivr_breakdown).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No IVR data available</p>
          ) : (
            <div className="space-y-3">
              {(Object.entries(summary.ivr_breakdown) as [string, number][]).map(([option, count]) => {
                const allValues = Object.values(summary.ivr_breakdown) as number[]
                const total = allValues.reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={option}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700">{option}</span>
                      <span className="text-gray-500">{count} calls ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" /> Call Outcomes
          </h2>
          {Object.entries(summary.outcome_breakdown).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No outcome data available</p>
          ) : (
            <div className="space-y-3">
              {(Object.entries(summary.outcome_breakdown) as [string, number][]).map(([outcome, count]) => {
                const allValues = Object.values(summary.outcome_breakdown) as number[]
                const total = allValues.reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                const barColor: Record<string, string> = {
                  answered: 'bg-green-500',
                  not_answered: 'bg-red-500',
                  busy: 'bg-yellow-500',
                  call_back: 'bg-blue-500',
                  confirmed: 'bg-emerald-500',
                  cancelled: 'bg-gray-500',
                }
                return (
                  <div key={outcome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700">{outcome.replace(/_/g, ' ')}</span>
                      <span className="text-gray-500">{count} calls ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`${barColor[outcome] || 'bg-blue-500'} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Call Volume Trend
          </h2>
          {summary.call_volume.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No call volume data available</p>
          ) : (
            <div className="space-y-2">
              {summary.call_volume.map((v: any) => {
                const maxCount = Math.max(...summary.call_volume.map((x: any) => x.count), 1)
                const pct = (v.count / maxCount) * 100
                return (
                  <div key={v.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24 shrink-0">{v.date}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div className="bg-blue-500 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-8 text-right">{v.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
