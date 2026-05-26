import { useState, useEffect } from 'react'
import {
  Drawer, Box, Typography, Tabs, Tab, TextField, Button,
  InputAdornment, IconButton, Divider, CircularProgress,
  Alert, Stack,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import SaveIcon from '@mui/icons-material/Save'
import { getSettings, saveSettings } from '../api'

const DRAWER_WIDTH = 480

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null
}

const EMPTY_FORM = {
  ps_base_url: '', ps_auth_type: 'basic', ps_username: '', ps_password: '',
  ps_endpoint: '', ps_process_name: 'SM_DISCOVERY',
  sftp_host: '', sftp_port: '22', sftp_username: '',
  sftp_password: '', sftp_remote_path: '', cors_origins: '*',
}

export default function SettingsDrawer({ open, onClose }) {
  const [tab, setTab] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPsPassword, setShowPsPassword] = useState(false)
  const [showSftpPassword, setShowSftpPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setSuccess(false)
    getSettings()
      .then(res => {
        const d = res.data
        setForm({
          ps_base_url: d.ps_base_url ?? '',
          ps_auth_type: d.ps_auth_type ?? 'basic',
          ps_username: d.ps_username ?? '',
          ps_password: d.ps_password === '***' ? '' : (d.ps_password ?? ''),
          ps_endpoint: d.ps_endpoint ?? '',
          ps_process_name: d.ps_process_name ?? 'APPR_CLD_AE',
          sftp_host: d.sftp_host ?? '',
          sftp_port: d.sftp_port ?? '22',
          sftp_username: d.sftp_username ?? '',
          sftp_password: d.sftp_password === '***' ? '' : (d.sftp_password ?? ''),
          sftp_remote_path: d.sftp_remote_path ?? '',
          cors_origins: d.cors_origins ?? '*',
        })
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [open])

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await saveSettings(form)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to save settings. Check that the backend is running.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
          color: 'white',
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          Configuration
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="PeopleSoft" />
        <Tab label="SFTP" />
      </Tabs>

      {/* Scrollable body */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mt: 2 }}>Settings saved successfully.</Alert>}

            <TabPanel value={tab} index={0}>
              <Stack spacing={2.5}>
                <TextField
                  label="Base URL"
                  value={form.ps_base_url}
                  onChange={set('ps_base_url')}
                  fullWidth
                  size="small"
                  placeholder="https://your-ps-host/PSIGW"
                />
                <TextField
                  label="Auth Type"
                  value={form.ps_auth_type}
                  onChange={set('ps_auth_type')}
                  fullWidth
                  size="small"
                  select
                  SelectProps={{ native: true }}
                >
                  <option value="basic">Basic</option>
                  <option value="bearer">Bearer Token</option>
                </TextField>
                {form.ps_auth_type === 'basic' && (
                  <TextField
                    label="Username"
                    value={form.ps_username}
                    onChange={set('ps_username')}
                    fullWidth
                    size="small"
                    autoComplete="off"
                  />
                )}
                <TextField
                  label={form.ps_auth_type === 'bearer' ? 'Bearer Token' : 'Password'}
                  type={showPsPassword ? 'text' : 'password'}
                  value={form.ps_password}
                  onChange={set('ps_password')}
                  fullWidth
                  size="small"
                  autoComplete="new-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPsPassword(v => !v)} edge="end">
                          {showPsPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Endpoint"
                  value={form.ps_endpoint}
                  onChange={set('ps_endpoint')}
                  fullWidth
                  size="small"
                  placeholder="/RESTListeningConnector/PSFT_HR/ZS_RUN_APPE_API.v1/API"
                />
                <TextField
                  label="Process Name"
                  value={form.ps_process_name}
                  onChange={set('ps_process_name')}
                  fullWidth
                  size="small"
                  placeholder="APPR_CLD_AE"
                  helperText='Sent as {"processname": "..."} in the request body'
                />
              </Stack>
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <Stack spacing={2.5}>
                <TextField
                  label="Host"
                  value={form.sftp_host}
                  onChange={set('sftp_host')}
                  fullWidth
                  size="small"
                  placeholder="sftp.example.com"
                />
                <TextField
                  label="Port"
                  value={form.sftp_port}
                  onChange={set('sftp_port')}
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1, max: 65535 }}
                />
                <TextField
                  label="Username"
                  value={form.sftp_username}
                  onChange={set('sftp_username')}
                  fullWidth
                  size="small"
                  autoComplete="off"
                />
                <TextField
                  label="Password"
                  type={showSftpPassword ? 'text' : 'password'}
                  value={form.sftp_password}
                  onChange={set('sftp_password')}
                  fullWidth
                  size="small"
                  autoComplete="new-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowSftpPassword(v => !v)} edge="end">
                          {showSftpPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Remote Path"
                  value={form.sftp_remote_path}
                  onChange={set('sftp_remote_path')}
                  fullWidth
                  size="small"
                  placeholder="/path/to/output.csv"
                />
              </Stack>
            </TabPanel>
          </>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ p: 3 }}>
        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Drawer>
  )
}
