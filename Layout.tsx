import { NavLink, useLocation } from 'react-router-dom'
import {
  Phone, Users, CalendarDays, Menu, X, PhoneCall,
  Activity, Settings, Headphones, PhoneOutgoing, LogOut,
  FileText, LayoutDashboard
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/call-simulator', icon: Headphones, label: 'AI Call Simulator' },
  { to: '/outbound-call', icon: PhoneOutgoing, label: 'Outbound Call' },
  { to: '/analytics', icon: Activity, label: 'Call Analytics' },
  { to: '/call-history', icon: FileText, label: 'Call History' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/calls', icon: PhoneCall, label: 'Call Logs' },
  { to: '/slots', icon: CalendarDays, label: 'Slots' },
  { to: '/admin', icon: Settings, label: 'Admin' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  const currentPage = navItems.find(n => n.to === pathname)?.label || ''

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-blue-700 z-50 shadow">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">VDart Call Assist</h1>
                <p className="text-[10px] text-blue-200 -mt-0.5">AI Call Automation</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-blue-200 mr-1">/ {currentPage}</span>
            <div className="flex items-center gap-2 pl-2 border-l border-white/20">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[11px] font-bold">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="hidden md:block text-sm text-white font-medium">{user?.username}</span>
              <button onClick={logout} className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10" title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-56 bg-white border-r border-gray-200
        transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <nav className="h-full overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <main className="pt-16 lg:ml-56 min-h-screen">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
