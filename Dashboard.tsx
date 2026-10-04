import { useEffect, useState } from 'react'
import { Phone, Users, CheckCircle2, Clock, XCircle, CalendarDays, ArrowRight } from 'lucide-react'
import { api } from '../api/client'
import type { DashboardStats } from '../types'
import { useNavigate } from 'react-router-dom'

const statCards = [
  { key: 'total_calls', label: 'Total Calls', icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'today_calls', label: "Today's Calls", icon: Clock, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { key: 'confirmed_students', label: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'pending_students', label: 'Pending', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'cancelled_students', label: 'Cancelled', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'available_slots', label: 'Available Slots', icon: CalendarDays, color: 'text-purple-600', bg: 'bg-purple-50' },
]

const actions = [
  { to: '/students', label: 'Students', desc: 'Manage registrations' },
  { to: '/call-simulator', label: 'Call Simulator', desc: 'Test AI calls' },
  { to: '/outbound-call', label: 'Outbound Call', desc: 'Bulk calling' },
  { to: '/analytics', label: 'Analytics', desc: 'View reports' },
]

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.dashboard.stats().catch(() => null),
      api.dashboard.recentActivities(5).catch(() => []),
    ]).then(([s, r]) => {
      if (s) setStats(s)
      if (r) setRecent(r)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Platform overview</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {statCards.map((card) => (
            <div key={card.key} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-xl font-bold text-gray-900">
                  {stats ? (stats as any)[card.key] ?? 0 : 0}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            <button onClick={() => navigate('/call-history')} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {recent.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No recent activity</p>
            ) : (
              recent.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.type === 'inbound' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                    <span className="text-gray-700 truncate">{a.student_name || 'Unknown'}</span>
                    <span className="text-gray-400 text-xs">- {a.outcome}</span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{a.duration || 0}s</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <button
                key={a.to}
                onClick={() => navigate(a.to)}
                className="p-3 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-100 text-left transition-colors"
              >
                <p className="text-sm font-medium text-gray-800">{a.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
