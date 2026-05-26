import { useState, useEffect, useMemo } from 'react'
import {
  Box, Typography, Alert, CircularProgress, Grid, Card, CardContent,
  Select, MenuItem, FormControl, InputLabel, TextField, InputAdornment,
  ToggleButtonGroup, ToggleButton, Chip,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid } from '@mui/x-data-grid'
import SearchIcon      from '@mui/icons-material/Search'
import StorageIcon     from '@mui/icons-material/Storage'
import PublicIcon      from '@mui/icons-material/Public'
import TuneIcon        from '@mui/icons-material/Tune'
import BusinessIcon    from '@mui/icons-material/Business'
import FolderOpenIcon  from '@mui/icons-material/FolderOpen'
import { getDataGridSx } from '../utils/dataGridSx'
import { useAuth } from '../AuthContext'
import { getCoreHRFiles, getCoreHRFile } from '../api'

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, accent }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Icon sx={{ fontSize: 14, color: accent }} />
      <Typography sx={{
        fontFamily: '"Raleway", sans-serif', fontSize: '0.6rem', fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary',
      }}>
        {label}
      </Typography>
    </Box>
  )
}

// ── KpiCard ────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }) {
  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: color, opacity: 0.6 }} />
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography sx={{ fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'text.disabled', mb: 0.75 }}>
          {label}
        </Typography>
        <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

// ── FunctionalDashboard ────────────────────────────────────────────────────────

export default function FunctionalDashboard() {
  const { token } = useAuth()
  const theme  = useTheme()
  const accent = theme.palette.primary.main
  const mode   = theme.palette.mode

  const [files,        setFiles]        = useState([])
  const [selectedFile, setSelectedFile] = useState('')
  const [data,         setData]         = useState(null)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [loadingData,  setLoadingData]  = useState(false)
  const [error,        setError]        = useState(null)
  const [moduleSearch, setModuleSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all') // 'all' | 'on' | 'off'

  // Load file list on mount
  useEffect(() => {
    if (!token) return
    getCoreHRFiles(token)
      .then((res) => {
        const list = res.data.files || []
        setFiles(list)
        if (list.length) setSelectedFile(list[0].filename)
      })
      .catch(() => setError('Could not load CoreHR files'))
      .finally(() => setLoadingFiles(false))
  }, [token])

  // Load file data when selection changes
  useEffect(() => {
    if (!token || !selectedFile) return
    setLoadingData(true)
    setData(null)
    getCoreHRFile(selectedFile, token)
      .then((res) => setData(res.data))
      .catch(() => setError(`Could not parse ${selectedFile}`))
      .finally(() => setLoadingData(false))
  }, [token, selectedFile])

  // KPIs derived from parsed data
  const kpi = useMemo(() => {
    if (!data) return null
    const moduleEntries    = Object.entries(data.modules || {})
    const on               = moduleEntries.filter(([, v]) =>  v).length
    const off              = moduleEntries.filter(([, v]) => !v).length
    const activeCountries  = Object.values(data.countries || {}).filter(Boolean).length
    return { on, off, activeCountries, buCount: (data.business_units || []).length }
  }, [data])

  // Filtered module rows for DataGrid
  const filteredModules = useMemo(() => {
    if (!data) return []
    return Object.entries(data.modules || {})
      .filter(([key, val]) => {
        const matchSearch = !moduleSearch || key.toLowerCase().includes(moduleSearch.toLowerCase())
        const matchFilter = moduleFilter === 'all' || (moduleFilter === 'on' ? val : !val)
        return matchSearch && matchFilter
      })
      .map(([key, val], i) => ({ id: i, module: key, enabled: val }))
  }, [data, moduleSearch, moduleFilter])

  // Business Unit rows for DataGrid
  const buRows = useMemo(
    () => (data?.business_units || []).map((bu, i) => ({ id: i, ...bu })),
    [data],
  )

  // ── render ─────────────────────────────────────────────────────────────────
  if (loadingFiles) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={24} sx={{ color: 'primary.main' }} />
      </Box>
    )
  }

  if (!files.length) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <FolderOpenIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 2 }} />
        <Typography sx={{ fontFamily: '"Raleway", sans-serif', color: 'text.secondary', fontSize: '0.88rem' }}>
          No CoreHR Discovery files found
        </Typography>
        <Typography sx={{ fontFamily: '"Raleway", sans-serif', color: 'text.disabled', fontSize: '0.76rem', mt: 0.5 }}>
          Run a Discovery configuration to generate one
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* ── File picker ────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 340 }}>
          <InputLabel sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.8rem' }}>
            CoreHR Discovery File
          </InputLabel>
          <Select
            value={selectedFile}
            label="CoreHR Discovery File"
            onChange={(e) => setSelectedFile(e.target.value)}
            sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.76rem' }}
          >
            {files.map((f) => (
              <MenuItem key={f.filename} value={f.filename}
                sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.74rem' }}>
                {f.filename}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {data && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {data.run_date && (
              <Chip label={`Run: ${data.run_date}`} size="small"
                sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.6rem', bgcolor: `${accent}12`, color: 'text.secondary' }} />
            )}
            {data.company && (
              <Chip label={`Company: ${data.company}`} size="small"
                sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.6rem', bgcolor: `${accent}12`, color: 'primary.main' }} />
            )}
          </Box>
        )}
        {loadingData && <CircularProgress size={18} sx={{ color: 'primary.main' }} />}
      </Box>

      {data && kpi && (
        <>
          {/* ── KPI strip ──────────────────────────────────────────────── */}
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}><KpiCard label="Modules ON"       value={kpi.on}              color="#6b8f71" /></Grid>
            <Grid item xs={6} sm={3}><KpiCard label="Modules OFF"      value={kpi.off}             color="#b45050" /></Grid>
            <Grid item xs={6} sm={3}><KpiCard label="Countries Active" value={kpi.activeCountries} color="#6495b4" /></Grid>
            <Grid item xs={6} sm={3}><KpiCard label="Business Units"   value={kpi.buCount}         color={accent}  /></Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* ── Module grid (left 2/3) ──────────────────────────────── */}
            <Grid item xs={12} md={8}>
              <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider' }}>
                <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <SectionHeader icon={StorageIcon} label="PS Module Status" accent={accent} />
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TextField
                      size="small"
                      placeholder="Search modules…"
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                          </InputAdornment>
                        ),
                        sx: { fontFamily: '"Raleway", sans-serif', fontSize: '0.78rem' },
                      }}
                      sx={{
                        width: 200,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '2px',
                          '& fieldset': { borderColor: 'divider' },
                          '&.Mui-focused fieldset': { borderColor: accent },
                        },
                      }}
                    />
                    <ToggleButtonGroup
                      value={moduleFilter}
                      exclusive
                      onChange={(_, v) => v && setModuleFilter(v)}
                      size="small"
                      sx={{
                        '& .MuiToggleButton-root': {
                          px: 1.2, py: 0.4,
                          fontFamily: '"Raleway", sans-serif',
                          fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                          border: '1px solid', borderColor: 'divider', color: 'text.disabled',
                          borderRadius: '2px !important',
                          '&.Mui-selected': { bgcolor: `${accent}18`, color: accent, borderColor: `${accent}40` },
                        },
                      }}
                    >
                      <ToggleButton value="all">All</ToggleButton>
                      <ToggleButton value="on">ON</ToggleButton>
                      <ToggleButton value="off">OFF</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                </Box>
                <DataGrid
                  rows={filteredModules}
                  autoHeight
                  disableRowSelectionOnClick
                  pageSizeOptions={[25, 50, 100]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                  sx={{ ...getDataGridSx(accent, mode), border: 'none', borderRadius: 0 }}
                  columns={[
                    {
                      field: 'module', headerName: 'Module', flex: 1, minWidth: 200,
                      renderCell: (p) => (
                        <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.74rem', color: 'text.primary' }}>
                          {p.value}
                        </Typography>
                      ),
                    },
                    {
                      field: 'enabled', headerName: 'Status', width: 100,
                      renderCell: (p) => (
                        <Chip
                          label={p.value ? 'ON' : 'OFF'}
                          size="small"
                          sx={{
                            bgcolor: p.value ? 'rgba(107,143,113,0.14)' : 'rgba(180,80,80,0.12)',
                            color:   p.value ? '#6b8f71' : '#b45050',
                            fontFamily: '"Raleway", sans-serif',
                            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', height: 20,
                          }}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </Grid>

            {/* ── Right column: countries + parameters ──────────────────── */}
            <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              {/* Countries */}
              <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider' }}>
                <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <SectionHeader icon={PublicIcon} label="Countries Implemented" accent={accent} />
                </Box>
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {Object.entries(data.countries || {}).map(([country, active]) => (
                    <Box key={country} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.75, borderRadius: '2px', bgcolor: active ? 'rgba(107,143,113,0.06)' : 'transparent' }}>
                      <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.74rem', color: active ? 'text.primary' : 'text.disabled' }}>
                        {country}
                      </Typography>
                      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', color: active ? '#6b8f71' : 'text.disabled', fontWeight: active ? 700 : 400 }}>
                        {active ? '✓' : '—'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Card>

              {/* Key Parameters */}
              <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider' }}>
                <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <SectionHeader icon={TuneIcon} label="Key Parameters" accent={accent} />
                </Box>
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {Object.entries(data.parameters || {}).map(([key, val]) => (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.68rem', color: 'text.secondary', flexShrink: 0, maxWidth: '55%' }}>
                        {key}
                      </Typography>
                      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: accent, textAlign: 'right', wordBreak: 'break-all' }}>
                        {val}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Card>
            </Grid>
          </Grid>

          {/* ── Business Units ──────────────────────────────────────────── */}
          {buRows.length > 0 && (
            <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider' }}>
              <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <SectionHeader icon={BusinessIcon} label="Business Units" accent={accent} />
              </Box>
              <DataGrid
                rows={buRows}
                autoHeight
                disableRowSelectionOnClick
                hideFooter={buRows.length <= 10}
                sx={{ ...getDataGridSx(accent, mode), border: 'none', borderRadius: 0 }}
                columns={[
                  {
                    field: 'code', headerName: 'BU Code', width: 130,
                    renderCell: (p) => (
                      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.74rem', color: 'primary.main' }}>{p.value}</Typography>
                    ),
                  },
                  {
                    field: 'description', headerName: 'Description', flex: 1, minWidth: 160,
                    renderCell: (p) => (
                      <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.74rem', color: 'text.primary' }}>{p.value || '—'}</Typography>
                    ),
                  },
                  {
                    field: 'active', headerName: 'Active', width: 100,
                    renderCell: (p) => p.value
                      ? <Chip label="Active" size="small" sx={{ bgcolor: 'rgba(107,143,113,0.14)', color: '#6b8f71', fontFamily: '"Raleway", sans-serif', fontSize: '0.58rem', height: 20 }} />
                      : <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>—</Typography>,
                  },
                ]}
              />
            </Card>
          )}
        </>
      )}
    </Box>
  )
}
