import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  Select, MenuItem, CircularProgress, Alert,
  LinearProgress, Tooltip, Divider, IconButton,
} from '@mui/material'
import FlashOnIcon        from '@mui/icons-material/FlashOn'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import CloudDownloadIcon  from '@mui/icons-material/CloudDownload'
import AutoAwesomeIcon    from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'
import LockIcon           from '@mui/icons-material/Lock'
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates'
import WarningAmberIcon   from '@mui/icons-material/WarningAmber'
import ReplayIcon         from '@mui/icons-material/Replay'
import StorageIcon        from '@mui/icons-material/Storage'
import ViewColumnIcon     from '@mui/icons-material/ViewColumn'
import TaskAltIcon        from '@mui/icons-material/TaskAlt'
import VerifiedIcon       from '@mui/icons-material/VerifiedUser'
import BarChartIcon       from '@mui/icons-material/BarChart'
import HistoryIcon        from '@mui/icons-material/History'
import ArrowBackIcon      from '@mui/icons-material/ArrowBack'
import {
  runConfig, analyzeRunOutput, listRuns,
  listInsightModels, listConfigs, formatApiError,
  listAnalysisResults, getAnalysisResult, reconstructRunOutput,
} from '../api'
import { useAuth }         from '../AuthContext'
import { useThemeContext } from '../ThemeContext'
import DataTable           from '../components/DataTable'
import MultiSectionReport  from '../components/MultiSectionReport'
import { ChartCard }       from '../components/DynamicChart'

// ── constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Submitting to PeopleSoft', Icon: FlashOnIcon },
  { label: 'PS Job Running',           Icon: HourglassEmptyIcon },
  { label: 'Downloading via FTP',      Icon: CloudDownloadIcon },
  { label: 'AI Analysis',              Icon: AutoAwesomeIcon },
]

function fmtMs(ms) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
  return `${(ms / 60000).toFixed(1)} min`
}

// ── AnimatedRings ─────────────────────────────────────────────────────────────

function AnimatedRings({ accent, size = 140 }) {
  const rings = [0, 1, 2]
  return (
    <Box sx={{
      position: 'relative', width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {rings.map((i) => (
        <Box key={i} sx={{
          position: 'absolute',
          width:  size - i * (size * 0.2),
          height: size - i * (size * 0.2),
          borderRadius: '50%',
          border: `1.5px solid ${accent}`,
          opacity: 0.3 + i * 0.08,
          '@keyframes ringPulse': {
            '0%':   { transform: 'scale(1)',    opacity: 0.3 + i * 0.08 },
            '50%':  { transform: 'scale(1.07)', opacity: 0.65 - i * 0.05 },
            '100%': { transform: 'scale(1)',    opacity: 0.3 + i * 0.08 },
          },
          animation: `ringPulse ${1.6 + i * 0.45}s ease-in-out infinite`,
          animationDelay: `${i * 0.22}s`,
        }} />
      ))}
      <AutoAwesomeIcon sx={{ fontSize: size * 0.26, color: accent, zIndex: 1 }} />
    </Box>
  )
}

// ── StepTracker ───────────────────────────────────────────────────────────────

function StepTracker({ activeStep, completedSteps, accent }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {STEPS.map(({ label, Icon }, i) => {
        const done   = completedSteps.has(i)
        const active = !done && i === activeStep
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: done ? `${accent}20` : active ? `${accent}14` : 'transparent',
              border: `1.5px solid ${done ? accent : active ? `${accent}55` : 'divider'}`,
              transition: 'all 0.3s ease',
            }}>
              {done
                ? <CheckCircleIcon sx={{ fontSize: 14, color: accent }} />
                : <Icon sx={{ fontSize: 14, color: active ? accent : 'text.disabled', transition: 'color 0.3s ease' }} />
              }
            </Box>
            <Typography sx={{
              fontSize: '0.78rem', fontFamily: '"Raleway", sans-serif',
              fontWeight: done || active ? 600 : 400,
              color: done ? 'text.primary' : active ? accent : 'text.disabled',
              transition: 'color 0.3s ease',
              ...(active && {
                '@keyframes stepBlink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                animation: 'stepBlink 1.4s ease-in-out infinite',
              }),
            }}>
              {label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

// ── LoadingView ───────────────────────────────────────────────────────────────

function LoadingView({ activeStep, completedSteps, phase, elapsed, accent, modelName }) {
  const progress = Math.min(95,
    completedSteps.size / STEPS.length * 90 + (phase === 'analysing' ? 12 : 0)
  )
  const phaseLabel = phase === 'analysing'
    ? `Analysing data${modelName ? ` with ${modelName}` : ''}…`
    : 'PeopleSoft run in progress…'
  const mins = Math.floor(elapsed / 60)
  const secs = String(elapsed % 60).padStart(2, '0')

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 500, gap: 4, py: 6,
    }}>
      <AnimatedRings accent={accent} />

      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: '1.25rem', fontWeight: 600, mb: 0.75, color: 'text.primary',
        }}>
          {phaseLabel}
        </Typography>
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.72rem', color: 'text.disabled',
        }}>
          {mins}:{secs} elapsed
        </Typography>
      </Box>

      <Box sx={{ width: '100%', maxWidth: 420 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 3, borderRadius: 2,
            bgcolor: `${accent}1a`,
            '& .MuiLinearProgress-bar': { bgcolor: accent, borderRadius: 2 },
          }}
        />
        <Typography sx={{
          fontSize: '0.58rem', color: 'text.disabled',
          fontFamily: '"Raleway", sans-serif',
          letterSpacing: '0.14em', mt: 0.75, textAlign: 'right',
        }}>
          {Math.round(progress)}% COMPLETE
        </Typography>
      </Box>

      <StepTracker activeStep={activeStep} completedSteps={completedSteps} accent={accent} />
    </Box>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ Icon, label, accent, sub, subColor, mt }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, mt: mt ?? 4 }}>
      <Box sx={{ width: '3px', height: 20, bgcolor: accent, opacity: 0.7, flexShrink: 0, borderRadius: '2px' }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Icon sx={{ fontSize: 16, color: accent }} />
        <Typography sx={{
          fontFamily: '"Cormorant Garamond", serif',
          fontWeight: 600, fontSize: '1.1rem', letterSpacing: '0.04em', color: 'text.primary',
        }}>
          {label}
        </Typography>
        {sub && (
          <Typography sx={{
            fontSize: '0.65rem', fontFamily: '"Raleway", sans-serif',
            color: subColor || 'text.secondary', ml: 0.5,
          }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// ── RunMetaBar ────────────────────────────────────────────────────────────────

function RunMetaBar({ runResult, accent }) {
  const fields = [
    { label: 'Instance',  value: runResult?.instance_id },
    { label: 'Report',    value: runResult?.report_id },
    { label: 'Rows',      value: runResult?.row_count?.toLocaleString() },
    { label: 'Duration',  value: runResult?.runs?.[0]?.duration_ms ? fmtMs(runResult.runs[0].duration_ms) : null },
    { label: 'Run ID',    value: runResult?.runs?.[0]?.id ? `#${runResult.runs[0].id}` : null },
  ]
  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 3, px: 3, py: 2, mb: 3,
      border: '1px solid', borderColor: 'divider',
      borderTop: `2px solid ${accent}55`,
      borderRadius: '2px', bgcolor: 'background.paper',
    }}>
      {fields.map(({ label, value }) => (
        <Box key={label}>
          <Typography sx={{
            fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'text.disabled', fontFamily: '"Raleway", sans-serif', mb: 0.3,
          }}>
            {label}
          </Typography>
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.82rem', color: value ? 'text.primary' : 'text.disabled',
          }}>
            {value || '—'}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// ── AIInsightsPanel ───────────────────────────────────────────────────────────

function AIInsightsPanel({ analysisResult, accent }) {
  const sections = analysisResult?.sections || {}
  const charts   = analysisResult?.charts   || []

  return (
    <Box>
      {sections.executive_summary && (
        <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider', mb: 2.5 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <AutoAwesomeIcon sx={{ fontSize: 15, color: accent }} />
              <Typography sx={{
                fontFamily: '"Raleway", sans-serif', fontWeight: 700,
                fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary',
              }}>
                Executive Summary
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.88rem', color: 'text.primary', lineHeight: 1.75, fontFamily: '"Raleway", sans-serif' }}>
              {sections.executive_summary}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        {sections.key_findings?.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <TipsAndUpdatesIcon sx={{ fontSize: 15, color: accent }} />
                  <Typography sx={{
                    fontFamily: '"Raleway", sans-serif', fontWeight: 700,
                    fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary',
                  }}>
                    Key Findings
                  </Typography>
                </Box>
                {sections.key_findings.map((finding, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.25 }}>
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: accent, flexShrink: 0, mt: 0.85 }} />
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.65, fontFamily: '"Raleway", sans-serif' }}>
                      {finding}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {sections.recommendations?.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider', height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <TaskAltIcon sx={{ fontSize: 15, color: '#6b8f71' }} />
                  <Typography sx={{
                    fontFamily: '"Raleway", sans-serif', fontWeight: 700,
                    fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary',
                  }}>
                    Recommendations
                  </Typography>
                </Box>
                {sections.recommendations.map((rec, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.25 }}>
                    <Typography sx={{
                      fontSize: '0.62rem', fontFamily: '"JetBrains Mono", monospace',
                      color: '#6b8f71', flexShrink: 0, mt: 0.1, fontWeight: 700,
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.65, fontFamily: '"Raleway", sans-serif' }}>
                      {rec}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {sections.anomalies?.length > 0 && (
        <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'rgba(201,168,76,0.22)', mb: 2.5 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <WarningAmberIcon sx={{ fontSize: 15, color: '#c9a84c' }} />
              <Typography sx={{
                fontFamily: '"Raleway", sans-serif', fontWeight: 700,
                fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary',
              }}>
                Anomalies & Issues
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {sections.anomalies.map((anomaly, i) => (
                <Chip
                  key={i} label={anomaly} size="small"
                  sx={{
                    bgcolor: 'rgba(201,168,76,0.1)', color: '#c9a84c',
                    fontSize: '0.72rem', height: 'auto', py: 0.5,
                    '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.4 },
                  }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {analysisResult?.summary && (
        <Typography sx={{
          fontSize: '0.82rem', color: 'text.secondary', lineHeight: 1.75,
          mb: 3.5, p: 2.5,
          border: '1px solid', borderColor: 'divider',
          borderRadius: '2px', bgcolor: `${accent}05`,
          fontFamily: '"Raleway", sans-serif',
        }}>
          {analysisResult.summary}
        </Typography>
      )}

      {charts.length > 0 && (
        <Box>
          <SectionHeader Icon={BarChartIcon} label="AI-Generated Charts" accent={accent} sub={`${charts.length} charts`} />
          <Grid container spacing={2.5}>
            {charts.map((spec) => (
              <Grid item xs={12} md={6} key={spec.id || spec.title}>
                <ChartCard spec={spec} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  )
}

// ── ColumnCard ────────────────────────────────────────────────────────────────

function ColumnCard({ col, accent }) {
  const isNumeric  = 'min' in col
  const nullColor  = col.null_pct > 30 ? '#b45050' : col.null_pct > 10 ? '#c9a84c' : '#6b8f71'
  const topEntries = Object.entries(col.top_values || {}).slice(0, 5)
  const maxCount   = topEntries.length ? Math.max(...topEntries.map(([, v]) => v)) : 1

  const fmt = (n) => {
    if (n == null) return '—'
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`
    return typeof n === 'number' ? n.toFixed(2) : String(n)
  }

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem',
            color: 'text.primary', fontWeight: 700, wordBreak: 'break-all', flex: 1,
          }}>
            {col.name}
          </Typography>
          <Chip
            label={col.dtype || (isNumeric ? 'numeric' : 'text')}
            size="small"
            sx={{ bgcolor: `${accent}14`, color: accent, fontSize: '0.54rem', height: 16, flexShrink: 0 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.52rem', letterSpacing: '0.16em', color: 'text.disabled', textTransform: 'uppercase', mb: 0.4 }}>
              Null %
            </Typography>
            <Box sx={{ height: 3, bgcolor: 'divider', borderRadius: 2, mb: 0.3 }}>
              <Box sx={{ height: '100%', width: `${Math.min(100, col.null_pct || 0)}%`, bgcolor: nullColor, borderRadius: 2 }} />
            </Box>
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.62rem', color: nullColor }}>
              {(col.null_pct || 0).toFixed(1)}%
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.52rem', letterSpacing: '0.16em', color: 'text.disabled', textTransform: 'uppercase', mb: 0.4 }}>
              Unique
            </Typography>
            <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.62rem', color: 'text.secondary' }}>
              {(col.unique || 0).toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {isNumeric ? (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
              {[['min', col.min], ['mean', col.mean], ['max', col.max]].map(([lbl, val]) => (
                <Box key={lbl}>
                  <Typography sx={{ fontSize: '0.48rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{lbl}</Typography>
                  <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.62rem', color: 'text.secondary' }}>{fmt(val)}</Typography>
                </Box>
              ))}
            </Box>
            {col.max !== col.min && (
              <Box sx={{ position: 'relative', height: 4, bgcolor: `${accent}14`, borderRadius: 2 }}>
                <Box sx={{
                  position: 'absolute', height: '100%',
                  width: `${Math.min(100, ((col.mean - col.min) / (col.max - col.min)) * 100)}%`,
                  background: `linear-gradient(90deg, ${accent}33, ${accent})`,
                  borderRadius: 2,
                }} />
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {topEntries.map(([val, count]) => (
              <Box key={val}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                  <Typography sx={{
                    fontSize: '0.58rem', color: 'text.secondary',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%',
                  }}>
                    {String(val)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled', fontFamily: '"JetBrains Mono", monospace' }}>
                    {count}
                  </Typography>
                </Box>
                <Box sx={{ height: 2, bgcolor: 'divider', borderRadius: 1 }}>
                  <Box sx={{ height: '100%', width: `${(count / maxCount) * 100}%`, bgcolor: `${accent}77`, borderRadius: 1 }} />
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

// ── ColumnDeepDive ────────────────────────────────────────────────────────────

function ColumnDeepDive({ profiles, accent }) {
  return (
    <Box>
      <SectionHeader Icon={ViewColumnIcon} label="Column Deep Dive" accent={accent} sub={`${profiles.length} columns`} />
      <Grid container spacing={2}>
        {profiles.map((col, i) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={col.name || i}>
            <ColumnCard col={col} accent={accent} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

// ── DQPanel ───────────────────────────────────────────────────────────────────

function DQPanel({ dqResults, accent }) {
  const passed = dqResults.filter((r) => r.passed).length
  const failed = dqResults.filter((r) => !r.passed).length

  return (
    <Box>
      <SectionHeader
        Icon={VerifiedIcon} label="Data Quality" accent={accent}
        sub={`${passed} passed · ${failed} failed`}
        subColor={failed > 0 ? '#b45050' : '#6b8f71'}
      />
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '2px', overflow: 'hidden' }}>
        {dqResults.map((rule, i) => (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            px: 2.5, py: 1.25,
            borderBottom: i < dqResults.length - 1 ? '1px solid' : 'none',
            borderColor: 'divider',
            bgcolor: !rule.passed ? 'rgba(180,80,80,0.04)' : 'transparent',
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: rule.passed ? '#6b8f71' : '#b45050' }} />
            <Typography sx={{ flex: 1, fontFamily: '"Raleway", sans-serif', fontSize: '0.78rem', color: 'text.primary', minWidth: 120 }}>
              {rule.rule_name}
            </Typography>
            {rule.rule_type && (
              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontFamily: '"JetBrains Mono", monospace' }}>
                {rule.rule_type}
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontFamily: '"Raleway", sans-serif', maxWidth: 240 }}>
              {rule.message}
            </Typography>
            <Chip
              label={rule.passed ? 'pass' : 'fail'} size="small"
              sx={{
                bgcolor: rule.passed ? 'rgba(107,143,113,0.14)' : 'rgba(180,80,80,0.14)',
                color:   rule.passed ? '#6b8f71' : '#b45050',
                fontSize: '0.58rem', height: 18, flexShrink: 0,
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ── ResultsView ───────────────────────────────────────────────────────────────

function ResultsView({ runResult, analysisResult, accent }) {
  const meta           = analysisResult?.meta || {}
  const columnProfiles = meta.column_profiles || []
  const dqResults      = runResult?.dq_results || []
  const rows           = runResult?.rows    || []
  const columns        = runResult?.columns || []
  const isMultiSection = runResult?.report_type === 'multi_section'
  const hasDataset     = isMultiSection ? (runResult?.sections?.length > 0) : rows.length > 0

  return (
    <Box sx={{
      '@keyframes fadeUp': {
        from: { opacity: 0, transform: 'translateY(14px)' },
        to:   { opacity: 1, transform: 'translateY(0)' },
      },
      animation: 'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      <RunMetaBar runResult={runResult} accent={accent} />

      {meta.pii_protected && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, mb: 3,
          px: 2, py: 1,
          border: '1px solid', borderColor: `${accent}22`,
          borderRadius: '2px', bgcolor: `${accent}06`,
        }}>
          <LockIcon sx={{ fontSize: 13, color: accent }} />
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"Raleway", sans-serif' }}>
            PII protection active — {meta.pii_masked_count} sensitive value{meta.pii_masked_count !== 1 ? 's' : ''} masked before AI analysis
          </Typography>
        </Box>
      )}

      {/* AI narrative + charts */}
      <SectionHeader Icon={AutoAwesomeIcon} label="AI Insights" accent={accent} mt={0} />
      <AIInsightsPanel analysisResult={analysisResult} accent={accent} />

      {/* Column profiles */}
      {columnProfiles.length > 0 && (
        <>
          <Divider sx={{ my: 4 }} />
          <ColumnDeepDive profiles={columnProfiles} accent={accent} />
        </>
      )}

      {/* Data quality */}
      {dqResults.length > 0 && (
        <>
          <Divider sx={{ my: 4 }} />
          <DQPanel dqResults={dqResults} accent={accent} />
        </>
      )}

      {/* Full dataset */}
      {hasDataset && (
        <>
          <Divider sx={{ my: 4 }} />
          <SectionHeader
            Icon={StorageIcon}
            label="Full Dataset"
            accent={accent}
            sub={isMultiSection
              ? `${runResult.sections.filter((s) => s.type === 'table').length} tables`
              : `${rows.length.toLocaleString()} rows · ${columns.length} columns`
            }
          />
          {isMultiSection
            ? <MultiSectionReport sections={runResult.sections} />
            : <DataTable rows={rows} columns={columns} />
          }
        </>
      )}
    </Box>
  )
}

// ── History helpers ───────────────────────────────────────────────────────────

function _bucketLabel(isoStr) {
  if (!isoStr) return 'Older'
  const d    = new Date(isoStr)
  const now  = new Date()
  const diff = now - d
  const day  = 86_400_000
  if (diff < day && d.getDate() === now.getDate()) return 'Today'
  if (diff < 2 * day) return 'Yesterday'
  if (diff < 7 * day) return 'This Week'
  if (diff < 30 * day) return 'This Month'
  return 'Older'
}

function _bucketOrder(label) {
  return { Today: 0, Yesterday: 1, 'This Week': 2, 'This Month': 3, Older: 4 }[label] ?? 5
}

function _groupByDate(items) {
  const groups = {}
  for (const item of items) {
    const label = _bucketLabel(item.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return Object.entries(groups).sort(([a], [b]) => _bucketOrder(a) - _bucketOrder(b))
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── HistoryPanel ──────────────────────────────────────────────────────────────

function HistoryPanel({ accent, onSelect, onClose }) {
  const { token }              = useAuth()
  const [items, setItems]      = useState([])
  const [loading, setLoading]  = useState(true)
  const [loadingId, setLoadingId] = useState(null)
  const [error, setError]      = useState(null)

  useEffect(() => {
    if (!token) return
    listAnalysisResults(token, { limit: 100 })
      .then(({ data }) => setItems(data.items || []))
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSelect = async (item) => {
    setLoadingId(item.id)
    try {
      const promises = [getAnalysisResult(item.id, token)]
      if (item.run_output_id) promises.push(reconstructRunOutput(item.run_output_id, token))
      const [{ data: ar }, runRes] = await Promise.all(promises)
      onSelect({
        analysisResult: ar.response_json,
        runResult:      runRes?.data ?? null,
      })
    } catch {
      setError('Failed to load this analysis. Please try another.')
    } finally {
      setLoadingId(null)
    }
  }

  const groups = _groupByDate(items)

  return (
    <Box sx={{
      '@keyframes fadeUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: 'fadeUp 0.3s ease both',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: '3px', height: 20, bgcolor: accent, opacity: 0.7, flexShrink: 0, borderRadius: '2px' }} />
          <HistoryIcon sx={{ fontSize: 16, color: accent }} />
          <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 600, fontSize: '1.1rem', color: 'text.primary' }}>
            Analysis History
          </Typography>
          {!loading && (
            <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontFamily: '"Raleway", sans-serif' }}>
              {items.length} {items.length === 1 ? 'result' : 'results'}
            </Typography>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} sx={{ color: accent }} />
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <HistoryIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1.5, opacity: 0.4 }} />
          <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.82rem', color: 'text.disabled' }}>
            No analysis history yet. Run & Analyse a config to get started.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {groups.map(([label, groupItems]) => (
            <Box key={label}>
              <Typography sx={{
                fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'text.disabled', fontFamily: '"Raleway", sans-serif',
                mb: 1.25, pl: 0.5,
              }}>
                {label}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {groupItems.map((item) => (
                  <Card
                    key={item.id}
                    variant="outlined"
                    onClick={() => loadingId === null && handleSelect(item)}
                    sx={{
                      bgcolor: 'background.paper',
                      borderColor: 'divider',
                      cursor: loadingId === item.id ? 'wait' : 'pointer',
                      transition: 'all 0.18s ease',
                      '&:hover': loadingId === null ? {
                        borderColor: `${accent}55`,
                        bgcolor: `${accent}05`,
                      } : {},
                    }}
                  >
                    <CardContent sx={{ p: '12px 16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                          fontFamily: '"Raleway", sans-serif', fontWeight: 600,
                          fontSize: '0.78rem', color: 'text.primary',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {item.filename}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.4, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontFamily: '"Raleway", sans-serif' }}>
                            {fmtDate(item.created_at)}
                          </Typography>
                          {item.model_id_str && (
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontFamily: '"JetBrains Mono", monospace' }}>
                              {item.model_id_str}
                            </Typography>
                          )}
                          {item.chart_count > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <BarChartIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
                              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontFamily: '"Raleway", sans-serif' }}>
                                {item.chart_count} charts
                              </Typography>
                            </Box>
                          )}
                          {item.total_rows > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <StorageIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
                              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontFamily: '"Raleway", sans-serif' }}>
                                {item.total_rows.toLocaleString()} rows
                              </Typography>
                            </Box>
                          )}
                          {item.provider && (
                            <Chip
                              label={item.provider}
                              size="small"
                              sx={{ bgcolor: `${accent}12`, color: accent, fontSize: '0.52rem', height: 14 }}
                            />
                          )}
                        </Box>
                      </Box>
                      {loadingId === item.id ? (
                        <CircularProgress size={16} sx={{ color: accent, flexShrink: 0 }} />
                      ) : (
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: `${accent}44`, flexShrink: 0 }} />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ── RunAnalyseDashboard ───────────────────────────────────────────────────────

export default function RunAnalyseDashboard() {
  const { token }        = useAuth()
  const { accent, mode } = useThemeContext()

  const [phase,           setPhase]           = useState('idle')
  const [activeStep,      setActiveStep]      = useState(0)
  const [completedSteps,  setCompletedSteps]  = useState(new Set())
  const [runResult,       setRunResult]       = useState(null)
  const [analysisResult,  setAnalysisResult]  = useState(null)
  const [error,           setError]           = useState(null)
  const [elapsed,         setElapsed]         = useState(0)
  const [configs,         setConfigs]         = useState([])
  const [activeConfigId,  setActiveConfigId]  = useState(null)
  const [models,          setModels]          = useState([])
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [initLoading,     setInitLoading]     = useState(true)
  // 'list' | 'result' — null means we're in the normal Run & Analyse mode
  const [historyView,     setHistoryView]     = useState(null)
  const [historyMeta,     setHistoryMeta]     = useState(null) // {filename, created_at}

  const pollRef    = useRef(null)
  const timerRef   = useRef(null)
  const startTsRef = useRef(null)

  useEffect(() => {
    if (!token) return
    Promise.all([listConfigs(token), listInsightModels()])
      .then(([{ data: cfgs }, { data: mdlData }]) => {
        const cfgList = Array.isArray(cfgs) ? cfgs : []
        const mdlList = mdlData.items ?? []
        setConfigs(cfgList)
        if (cfgList.length) setActiveConfigId(cfgList[0].id)
        setModels(mdlList)
        const def = mdlList.find((m) => m.is_default) || mdlList[0]
        if (def) setSelectedModelId(def.id)
      })
      .catch(() => {})
      .finally(() => setInitLoading(false))
  }, [token])

  useEffect(() => () => {
    clearInterval(pollRef.current)
    clearInterval(timerRef.current)
  }, [])

  const handleRun = useCallback(async () => {
    if (!activeConfigId || phase === 'running' || phase === 'analysing') return

    setPhase('running')
    setActiveStep(0)
    setCompletedSteps(new Set())
    setRunResult(null)
    setAnalysisResult(null)
    setError(null)
    setElapsed(0)

    startTsRef.current = Date.now()

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000))
    }, 1000)

    let lastInstanceId = ''
    let lastReportId   = ''

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await listRuns(token, { limit: 10 })
        const items  = data.items || []
        const cutoff = startTsRef.current - 15_000
        const run    = items.find(
          (r) => r.config_id === activeConfigId && new Date(r.started_at).getTime() >= cutoff
        )
        if (!run) return

        if (run.status === 'success') {
          setCompletedSteps(new Set([0, 1, 2]))
          setActiveStep(2)
        } else if (run.report_id && run.report_id !== lastReportId) {
          lastReportId = run.report_id
          setCompletedSteps((prev) => { const s = new Set(prev); s.add(0); s.add(1); return s })
          setActiveStep(2)
        } else if (run.instance_id && run.instance_id !== lastInstanceId) {
          lastInstanceId = run.instance_id
          setCompletedSteps((prev) => { const s = new Set(prev); s.add(0); return s })
          setActiveStep(1)
        }
      } catch { /* non-fatal */ }
    }, 2000)

    try {
      const { data: runData } = await runConfig(activeConfigId, token)
      clearInterval(pollRef.current)

      if (runData.success_count === 0) {
        const detail = runData.runs?.[0]?.error || 'All engines failed'
        throw new Error(detail)
      }

      setRunResult(runData)
      setCompletedSteps(new Set([0, 1, 2]))
      setActiveStep(3)
      setPhase('analysing')

      const runOutputId = runData.run_output_id
      if (!runOutputId) {
        throw new Error('No run output available for analysis — FTP download may have been skipped.')
      }

      const { data: analysis } = await analyzeRunOutput(runOutputId, selectedModelId, token)

      clearInterval(timerRef.current)
      setAnalysisResult(analysis)
      setCompletedSteps(new Set([0, 1, 2, 3]))
      setPhase('done')

    } catch (err) {
      clearInterval(pollRef.current)
      clearInterval(timerRef.current)
      setPhase('error')
      setError(formatApiError(err, 'Run failed. Please check your configuration and try again.'))
    }
  }, [activeConfigId, selectedModelId, token, phase])

  const handleHistorySelect = useCallback(({ analysisResult: ar, runResult: rr }) => {
    setAnalysisResult(ar)
    setRunResult(rr)
    setHistoryView('result')
  }, [])

  const inProgress = phase === 'running' || phase === 'analysing'
  const selectedModel = models.find((m) => m.id === selectedModelId)

  const _urlMatch = error ? error.match(/\(url:\s*(https?:\/\/[^)]+)\)/) : null
  const errorUrl  = _urlMatch?.[1] || null
  const errorMsg  = errorUrl ? error.replace(/\s*\(url:\s*https?:\/\/[^)]+\)/, '').trim() : (error || '')

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, mb: 4,
        flexWrap: 'wrap',
      }}>
        {/* History: back button when viewing a result */}
        {historyView === 'result' && (
          <Button
            startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
            onClick={() => { setHistoryView('list'); setRunResult(null); setAnalysisResult(null) }}
            size="small"
            sx={{
              color: 'text.secondary',
              fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem',
              textTransform: 'none', mr: 0.5,
              '&:hover': { color: accent },
            }}
          >
            Back to History
          </Button>
        )}

        {historyView === null && !initLoading && (
          <>
            <Select
              value={activeConfigId || ''}
              onChange={(e) => setActiveConfigId(e.target.value)}
              disabled={inProgress}
              displayEmpty
              size="small"
              sx={{
                minWidth: 210,
                fontFamily: '"Raleway", sans-serif',
                fontSize: '0.8rem',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '& .MuiSelect-select': { py: 1.15 },
              }}
            >
              {!configs.length && <MenuItem value="" disabled>No configurations</MenuItem>}
              {configs.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.8rem' }}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>

            {models.length > 0 && (
              <Select
                value={selectedModelId || ''}
                onChange={(e) => setSelectedModelId(e.target.value)}
                disabled={inProgress}
                size="small"
                sx={{
                  minWidth: 175,
                  fontFamily: '"Raleway", sans-serif',
                  fontSize: '0.8rem',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                  '& .MuiSelect-select': { py: 1.15 },
                }}
              >
                {models.map((m) => (
                  <MenuItem key={m.id} value={m.id} sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.8rem' }}>
                    {m.name || m.model_id}
                  </MenuItem>
                ))}
              </Select>
            )}

            <Button
              startIcon={inProgress
                ? <CircularProgress size={13} sx={{ color: 'background.default' }} />
                : <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              }
              onClick={handleRun}
              disabled={inProgress || !activeConfigId}
              sx={{
                bgcolor: 'primary.main',
                color: 'background.default',
                fontFamily: '"Raleway", sans-serif',
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '0.14em',
                px: 3,
                py: 1.2,
                borderRadius: '2px',
                boxShadow: `0 2px 20px ${accent}35`,
                '&:hover': { bgcolor: 'primary.light', boxShadow: `0 4px 28px ${accent}55` },
                '&.Mui-disabled': { opacity: 0.45 },
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                textTransform: 'none',
              }}
            >
              {inProgress ? 'Running…' : 'Run & Analyse'}
            </Button>

            {(phase === 'done' || phase === 'error') && (
              <Tooltip title="Start a new run" placement="right">
                <IconButton
                  size="small"
                  onClick={() => { setPhase('idle'); setError(null) }}
                  sx={{ color: 'text.secondary', '&:hover': { color: accent } }}
                >
                  <ReplayIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        {initLoading && historyView === null && (
          <CircularProgress size={20} sx={{ color: accent }} />
        )}

        {/* History toggle — always visible unless a run is in progress */}
        {!inProgress && (
          <Box sx={{ ml: 'auto' }}>
            {historyView === null ? (
              <Button
                startIcon={<HistoryIcon sx={{ fontSize: 15 }} />}
                onClick={() => setHistoryView('list')}
                size="small"
                variant="outlined"
                sx={{
                  color: 'text.secondary',
                  borderColor: 'divider',
                  fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem',
                  textTransform: 'none',
                  '&:hover': { borderColor: accent, color: accent },
                }}
              >
                History
              </Button>
            ) : (
              <Button
                startIcon={<AutoAwesomeIcon sx={{ fontSize: 15 }} />}
                onClick={() => { setHistoryView(null); setRunResult(null); setAnalysisResult(null); setPhase('idle') }}
                size="small"
                variant="outlined"
                sx={{
                  color: 'text.secondary',
                  borderColor: 'divider',
                  fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem',
                  textTransform: 'none',
                  '&:hover': { borderColor: accent, color: accent },
                }}
              >
                New Run
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* History views */}
      {historyView === 'list' && (
        <HistoryPanel accent={accent} onSelect={handleHistorySelect} />
      )}

      {historyView === 'result' && runResult && analysisResult && (
        <ResultsView runResult={runResult} analysisResult={analysisResult} accent={accent} />
      )}

      {historyView === 'result' && !runResult && analysisResult && (
        <Box>
          <Alert severity="info" sx={{ mb: 3, fontFamily: '"Raleway", sans-serif', fontSize: '0.82rem' }}>
            Run data is not available for this analysis — showing AI insights only.
          </Alert>
          <Box>
            <SectionHeader Icon={AutoAwesomeIcon} label="AI Insights" accent={accent} mt={0} />
            <AIInsightsPanel analysisResult={analysisResult} accent={accent} />
            {(analysisResult?.meta?.column_profiles?.length > 0) && (
              <>
                <Divider sx={{ my: 4 }} />
                <ColumnDeepDive profiles={analysisResult.meta.column_profiles} accent={accent} />
              </>
            )}
          </Box>
        </Box>
      )}

      {/* Normal run mode below — only shown when not in history */}
      {historyView === null && (
        <>

      {/* Error */}
      {phase === 'error' && error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.88rem', mb: errorUrl ? 1 : 0 }}>{errorMsg}</Typography>
          {errorUrl && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              mt: 0.75, px: 1.5, py: 0.75,
              bgcolor: 'rgba(180,80,80,0.08)',
              border: '1px solid rgba(180,80,80,0.2)',
              borderRadius: '3px', overflow: 'hidden',
            }}>
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6rem', fontWeight: 700, color: '#c98f8f', flexShrink: 0 }}>
                URL
              </Typography>
              <Typography
                title={errorUrl}
                sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
              >
                {errorUrl}
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      {/* Loading */}
      {inProgress && (
        <LoadingView
          activeStep={activeStep}
          completedSteps={completedSteps}
          phase={phase}
          elapsed={elapsed}
          accent={accent}
          modelName={selectedModel?.name || selectedModel?.model_id || null}
        />
      )}

      {/* Results */}
      {phase === 'done' && runResult && analysisResult && (
        <ResultsView runResult={runResult} analysisResult={analysisResult} accent={accent} />
      )}

      {/* Idle */}
      {phase === 'idle' && (
        <Box sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 440, gap: 3,
          '@keyframes idleFade': { from: { opacity: 0 }, to: { opacity: 1 } },
          animation: 'idleFade 0.4s ease both',
        }}>
          <Box sx={{ opacity: 0.35 }}>
            <AnimatedRings accent={accent} size={100} />
          </Box>
          <Box sx={{ textAlign: 'center', maxWidth: 380 }}>
            <Typography sx={{
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: '1.35rem', fontWeight: 600, color: 'text.secondary', mb: 1,
            }}>
              Run & Analyse
            </Typography>
            <Typography sx={{
              fontFamily: '"Raleway", sans-serif',
              fontSize: '0.82rem', color: 'text.disabled', lineHeight: 1.7,
            }}>
              Triggers a PeopleSoft run, downloads the report via FTP,
              then passes it to the AI model for instant insights.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            {['Trigger · poll · download in one step', 'AI-generated executive summary & findings', 'Column profiles, anomalies, and DQ checks'].map((t) => (
              <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: accent, opacity: 0.45, flexShrink: 0 }} />
                <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem', color: 'text.disabled' }}>
                  {t}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
        </>
      )}
    </Box>
  )
}
