import { useState, useEffect, useCallback } from 'react'
import { Box, CircularProgress } from '@mui/material'
import StartupScreen from './components/StartupScreen'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import SignInPage from './pages/SignIn'
import { useAuth } from './AuthContext'

const VALID_ROUTES = ['dashboard', 'settings', 'admin']

function getRoute() {
  const h = window.location.hash.slice(1)
  return VALID_ROUTES.includes(h) ? h : 'dashboard'
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [route, setRoute] = useState(getRoute)
  const { user, loading, signOut } = useAuth()

  useEffect(() => {
    const handler = () => setRoute(getRoute())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = useCallback((to) => {
    window.location.hash = to
    setRoute(to)
  }, [])

  if (!ready) return <StartupScreen onReady={() => setReady(true)} />

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0b0c0e' }}>
        <CircularProgress size={28} sx={{ color: '#c9a84c' }} />
      </Box>
    )
  }

  if (!user) return <SignInPage />

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0b0c0e' }}>
      <Sidebar route={route} navigate={navigate} user={user} onSignOut={signOut} />
      <Box sx={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {route === 'dashboard' && <Dashboard />}
        {route === 'settings' && <Settings />}
        {route === 'admin'    && <Admin />}
      </Box>
    </Box>
  )
}
