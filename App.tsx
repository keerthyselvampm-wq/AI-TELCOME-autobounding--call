import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ToastContainer from './components/Toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Calls from './pages/Calls'
import Slots from './pages/Slots'
import CallAnalytics from './pages/CallAnalytics'
import CallHistory from './pages/CallHistory'
import AdminConfig from './pages/AdminConfig'
import CallSimulator from './pages/CallSimulator'
import OutboundCall from './pages/OutboundCall'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/calls" element={<Calls />} />
              <Route path="/slots" element={<Slots />} />
              <Route path="/analytics" element={<CallAnalytics />} />
              <Route path="/call-history" element={<CallHistory />} />
              <Route path="/outbound-call" element={<OutboundCall />} />
              <Route path="/admin" element={<AdminConfig />} />
              <Route path="/call-simulator" element={<CallSimulator />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
