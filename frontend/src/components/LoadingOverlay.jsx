import { useState, useEffect } from 'react'
import { Backdrop, Box, Typography, Chip } from '@mui/material'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import StorageIcon from '@mui/icons-material/Storage'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import AnalyticsIcon from '@mui/icons-material/Analytics'

function useElapsed(running) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  return elapsed
}

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function statusMsg(s) {
  if (s < 10) return 'Establishing connection to PeopleSoft engine…'
  if (s < 30) return 'Engine running — query in progress…'
  if (s < 90) return 'Processing data, please hold…'
  return 'Downloading results via SFTP…'
}

const STEPS = [
  { icon: <StorageIcon sx={{ fontSize: 13 }} />, label: 'Trigger Engine' },
  { icon: <CloudDownloadIcon sx={{ fontSize: 13 }} />, label: 'Fetch CSV via SFTP' },
  { icon: <AnalyticsIcon sx={{ fontSize: 13 }} />, label: 'Compute Analytics' },
]

export default function LoadingOverlay({ open }) {
  const elapsed = useElapsed(open)
  const step = elapsed < 10 ? 0 : elapsed < 60 ? 1 : 2

  return (
    <Backdrop
      open={open}
      sx={{
        zIndex: t => t.zIndex.drawer + 1,
        background: 'rgba(6,11,22,0.96)',
        backdropFilter: 'blur(16px)',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Scan line */}
      <Box sx={{
        position: 'fixed', left: 0, right: 0, height: 80,
        background: 'linear-gradient(transparent, rgba(0,212,255,0.05), transparent)',
        pointerEvents: 'none',
        '@keyframes scan': { '0%': { top: '-10%' }, '100%': { top: '110%' } },
        animation: 'scan 4s ease-in-out infinite',
      }} />

      {/* Icon */}
      <Box sx={{ position: 'relative', width: 160, height: 160, mb: 4 }}>
        <Box sx={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1px dashed rgba(0,212,255,0.2)',
          '@keyframes spinCW': { to: { transform: 'rotate(360deg)' } },
          animation: 'spinCW 12s linear infinite',
        }} />
        <Box sx={{
          position: 'absolute', inset: 20, borderRadius: '50%',
          border: '1px solid rgba(247,37,133,0.25)',
          '@keyframes spinCCW': { to: { transform: 'rotate(-360deg)' } },
          animation: 'spinCCW 8s linear infinite',
        }} />
        <Box sx={{
          position: 'absolute', inset: 40, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)',
          border: '1.5px solid rgba(0,212,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          '@keyframes boltGlow': {
            '0%,100%': { filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' },
            '50%': { filter: 'drop-shadow(0 0 24px rgba(0,212,255,1))' },
          },
          animation: 'boltGlow 1.6s ease-in-out infinite',
          boxShadow: '0 0 30px rgba(0,212,255,0.15)',
        }}>
          <FlashOnIcon sx={{ fontSize: 44, color: '#00d4ff' }} />
        </Box>
      </Box>

      {/* Title */}
      <Typography sx={{
        fontFamily: '"Chakra Petch", monospace',
        fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.14em',
        color: '#e2e8f0', mb: 0.5,
      }}>
        ENGINE RUNNING
      </Typography>
      <Typography sx={{
        fontFamily: '"Chakra Petch", monospace',
        fontSize: '0.72rem', letterSpacing: '0.12em',
        color: '#3d5280', mb: 4,
      }}>
        {statusMsg(elapsed)}
      </Typography>

      {/* Segmented progress */}
      <Box sx={{ width: 360, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: '3px', mb: 1 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <Box key={i} sx={{
              flex: 1, height: 3, borderRadius: 2,
              background: 'rgba(0,212,255,0.08)',
              '@keyframes seg': {
                '0%,100%': { background: 'rgba(0,212,255,0.08)' },
                '50%':     { background: 'rgba(0,212,255,0.65)' },
              },
              animation: `seg 2s ease-in-out ${i * 0.07}s infinite`,
            }} />
          ))}
        </Box>
      </Box>

      {/* Timer chip */}
      <Chip
        icon={
          <Box sx={{
            width: 6, height: 6, borderRadius: '50%', bgcolor: '#00d4ff',
            '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.15 } },
            animation: 'blink 1s ease-in-out infinite',
            ml: '8px !important',
          }} />
        }
        label={fmt(elapsed)}
        sx={{
          fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
          fontSize: '0.9rem', letterSpacing: '0.08em',
          bgcolor: 'rgba(0,212,255,0.06)',
          border: '1px solid rgba(0,212,255,0.18)',
          color: '#00d4ff', px: 1, height: 34, mb: 4,
        }}
      />

      {/* Step indicators */}
      <Box sx={{ display: 'flex', gap: 3 }}>
        {STEPS.map(({ icon, label }, i) => (
          <Box key={label} sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            color: i === step ? '#00d4ff' : i < step ? '#10b981' : '#3d5280',
            fontSize: '0.72rem',
            fontFamily: '"Chakra Petch", monospace',
            letterSpacing: '0.06em',
            transition: 'color 0.5s ease',
            ...(i === step && {
              '@keyframes stepPulse': {
                '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 },
              },
              animation: 'stepPulse 1.5s ease-in-out infinite',
            }),
          }}>
            {icon}
            <Typography variant="caption" sx={{ color: 'inherit', fontFamily: 'inherit', letterSpacing: 'inherit' }}>
              {i + 1}. {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Backdrop>
  )
}
