import { useEffect, useState } from 'react'
import {
  Box, Typography, CircularProgress, Grid, Card, CardContent,
  Table, TableBody, TableCell, TableHead, TableRow, Tabs, Tab,
  Chip, Alert,
} from '@mui/material'
import { useAuth } from '../AuthContext'
import { listAdminStats, listAdminLogs, listAdminUsers, listAdminRuns, setUserRole } from '../api'

function StatCard({ label, value }) {
  return (
    <Card sx={{ bgcolor: '#14161a', borderColor: 'rgba(201,168,76,0.12)' }}>
      <CardContent>
        <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c9a84c', mb: 1 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#ede8d0' }}>{value}</Typography>
      </CardContent>
    </Card>
  )
}

const cellSx = { fontFamily: '"Raleway", sans-serif', fontSize: '0.78rem', color: '#ede8d0', borderColor: 'rgba(201,168,76,0.07)' }
const headSx = { fontFamily: '"Raleway", sans-serif', fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5a5040', borderColor: 'rgba(201,168,76,0.1)' }

export default function Admin() {
  const { token, user } = useAuth()
  const [tab, setTab]     = useState(0)
  const [stats, setStats] = useState(null)
  const [logs, setLogs]   = useState([])
  const [users, setUsers] = useState([])
  const [runs, setRuns]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([
      listAdminStats(token),
      listAdminLogs(token, { limit: 50 }),
      listAdminUsers(token, { limit: 100 }),
      listAdminRuns(token, { limit: 50 }),
    ])
      .then(([statsRes, logsRes, usersRes, runsRes]) => {
        setStats(statsRes.data)
        setLogs(logsRes.data.items ?? [])
        setUsers(usersRes.data.items ?? [])
        setRuns(runsRes.data.items ?? [])
        setError(null)
      })
      .catch((err) => setError(err.response?.data?.detail || 'Unable to load admin data'))
      .finally(() => setLoading(false))
  }, [token])

  const handleRoleToggle = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    try {
      await setUserRole(userId, newRole, token)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
    } catch {
      /* ignore */
    }
  }

  if (!user?.role || user.role !== 'admin') {
    return (
      <Box sx={{ p: 6 }}>
        <Typography sx={{ color: '#ede8d0', fontSize: '1.4rem', mb: 2 }}>Admin access required</Typography>
        <Typography sx={{ color: '#7a7060' }}>Only users with an admin role can view system statistics and audit logs.</Typography>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: '#c9a84c' }} />
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, minHeight: '100vh', bgcolor: '#0b0c0e', px: 5, py: 5 }}>
      <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.58rem', letterSpacing: '0.3em', color: '#3a3428', textTransform: 'uppercase', mb: 0.5 }}>System</Typography>
      <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', fontWeight: 700, color: '#ede8d0', mb: 4 }}>
        Admin Dashboard
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>{error}</Alert>}

      {/* KPI row */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 5 }}>
          <Grid item xs={6} sm={3}><StatCard label="Total users"    value={stats.total_users ?? 0} /></Grid>
          <Grid item xs={6} sm={3}><StatCard label="Total runs"     value={stats.total_runs ?? 0} /></Grid>
          <Grid item xs={6} sm={3}><StatCard label="Success rate"   value={`${stats.success_rate ?? 0}%`} /></Grid>
          <Grid item xs={6} sm={3}><StatCard label="Avg runtime"    value={`${stats.avg_duration_ms ?? 0}ms`} /></Grid>
        </Grid>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: '1px solid rgba(201,168,76,0.1)', '& .MuiTab-root': { fontFamily: '"Raleway"', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5a5040', minHeight: 40 }, '& .Mui-selected': { color: '#c9a84c' }, '& .MuiTabs-indicator': { bgcolor: '#c9a84c' } }}
      >
        <Tab label="Users" />
        <Tab label="Runs" />
        <Tab label="Audit log" />
      </Tabs>

      {tab === 0 && (
        <Card sx={{ bgcolor: '#14161a', borderColor: 'rgba(201,168,76,0.12)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Email</TableCell>
                <TableCell sx={headSx}>Role</TableCell>
                <TableCell sx={headSx}>Runs</TableCell>
                <TableCell sx={headSx}>Onboarded</TableCell>
                <TableCell sx={headSx}>Last seen</TableCell>
                <TableCell sx={headSx}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={cellSx}>{u.email}</TableCell>
                  <TableCell sx={cellSx}>
                    <Chip label={u.role} size="small" sx={{ bgcolor: u.role === 'admin' ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)', color: u.role === 'admin' ? '#c9a84c' : '#7a7060', fontFamily: '"Raleway"', fontSize: '0.62rem' }} />
                  </TableCell>
                  <TableCell sx={cellSx}>{u.run_count ?? 0}</TableCell>
                  <TableCell sx={cellSx}>{u.onboarded ? '✓' : '—'}</TableCell>
                  <TableCell sx={cellSx}>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell sx={cellSx}>
                    {u.id !== user.id && (
                      <Typography
                        onClick={() => handleRoleToggle(u.id, u.role)}
                        sx={{ cursor: 'pointer', fontSize: '0.68rem', color: '#c9a84c', fontFamily: '"Raleway"', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!users.length && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ ...cellSx, textAlign: 'center', color: '#3a3428' }}>No users yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === 1 && (
        <Card sx={{ bgcolor: '#14161a', borderColor: 'rgba(201,168,76,0.12)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>User</TableCell>
                <TableCell sx={headSx}>Config</TableCell>
                <TableCell sx={headSx}>Status</TableCell>
                <TableCell sx={headSx}>Rows</TableCell>
                <TableCell sx={headSx}>Duration</TableCell>
                <TableCell sx={headSx}>Started</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={cellSx}>{r.user_email || r.user_id}</TableCell>
                  <TableCell sx={cellSx}>{r.config_name || '—'}</TableCell>
                  <TableCell sx={cellSx}>
                    <Chip label={r.status} size="small" sx={{ bgcolor: r.status === 'success' ? 'rgba(107,143,113,0.15)' : r.status === 'error' ? 'rgba(143,74,74,0.15)' : 'rgba(201,168,76,0.1)', color: r.status === 'success' ? '#6b8f71' : r.status === 'error' ? '#8f4a4a' : '#c9a84c', fontFamily: '"Raleway"', fontSize: '0.62rem' }} />
                  </TableCell>
                  <TableCell sx={cellSx}>{r.row_count ?? '—'}</TableCell>
                  <TableCell sx={cellSx}>{r.duration_ms != null ? `${r.duration_ms}ms` : '—'}</TableCell>
                  <TableCell sx={cellSx}>{r.started_at ? new Date(r.started_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
              {!runs.length && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ ...cellSx, textAlign: 'center', color: '#3a3428' }}>No runs yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ bgcolor: '#14161a', borderColor: 'rgba(201,168,76,0.12)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>User</TableCell>
                <TableCell sx={headSx}>Event</TableCell>
                <TableCell sx={headSx}>Detail</TableCell>
                <TableCell sx={headSx}>IP</TableCell>
                <TableCell sx={headSx}>When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={cellSx}>{log.user_name || log.user_id || '—'}</TableCell>
                  <TableCell sx={cellSx}>{log.event_type}</TableCell>
                  <TableCell sx={{ ...cellSx, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem' }}>{JSON.stringify(log.detail)}</TableCell>
                  <TableCell sx={cellSx}>{log.ip_address || '—'}</TableCell>
                  <TableCell sx={cellSx}>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
              {!logs.length && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ ...cellSx, textAlign: 'center', color: '#3a3428' }}>No audit events yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  )
}
