import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, Button } from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import { checkHealth } from '../api'

const MAX_ATTEMPTS = 5
const RETRY_MS = 2000

export default function StartupScreen({ onReady }) {
  const [status, setStatus] = useState('checking')
  const timer = useRef(null)

  const runCheck = useCallback(() => {
    clearTimeout(timer.current)
    setStatus('checking')
    let attempts = 0
    const attempt = async () => {
      try {
        const res = await checkHealth()
        if (res.data?.status === 'ok') { onReady(); return }
        throw new Error('bad')
      } catch {
        attempts += 1
        if (attempts >= MAX_ATTEMPTS) setStatus('error')
        else timer.current = setTimeout(attempt, RETRY_MS)
      }
    }
    attempt()
  }, [onReady])

  useEffect(() => { runCheck(); return () => clearTimeout(timer.current) }, [runCheck])

  const isError = status === 'error'

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: '#0b0c0e',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Very subtle diagonal lines background */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(135deg, rgba(201,168,76,0.012) 0px, rgba(201,168,76,0.012) 1px, transparent 1px, transparent 60px)',
      }} />

      {/* Gold corner marks */}
      {[
        { top: 32, left: 32, borderTop: '1px solid', borderLeft: '1px solid' },
        { top: 32, right: 32, borderTop: '1px solid', borderRight: '1px solid' },
        { bottom: 32, left: 32, borderBottom: '1px solid', borderLeft: '1px solid' },
        { bottom: 32, right: 32, borderBottom: '1px solid', borderRight: '1px solid' },
      ].map((s, i) => (
        <Box key={i} sx={{ position: 'absolute', width: 24, height: 24, borderColor: 'rgba(201,168,76,0.2)', ...s }} />
      ))}

      {/* Center icon */}
      <Box sx={{ position: 'relative', mb: 5 }}>
        {/* Outer square frame */}
        <Box sx={{
          width: 130, height: 130,
          border: '1px solid rgba(201,168,76,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          '&::before': {
            content: '""', position: 'absolute', inset: -8,
            border: '1px solid rgba(201,168,76,0.06)',
          },
        }}>
          {/* Inner rotating square */}
          <Box sx={{
            position: 'absolute', inset: 20,
            border: '1px solid rgba(201,168,76,0.2)',
            '@keyframes rotateSq': { to: { transform: 'rotate(45deg)' } },
            animation: isError ? 'none' : 'rotateSq 8s linear infinite',
          }} />

          {isError
            ? <WifiOffIcon sx={{ fontSize: 40, color: 'rgba(143,74,74,0.7)', zIndex: 1 }} />
            : (
              <BoltIcon sx={{
                fontSize: 44, color: '#c9a84c', zIndex: 1,
                '@keyframes goldBreathe': {
                  '0%,100%': { filter: 'drop-shadow(0 0 4px rgba(201,168,76,0.3))' },
                  '50%': { filter: 'drop-shadow(0 0 16px rgba(201,168,76,0.8))' },
                },
                animation: 'goldBreathe 3s ease-in-out infinite',
              }} />
            )}
        </Box>
      </Box>

      {/* Top gold rule */}
      <Box sx={{
        width: 180,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)',
        mb: 3,
        '@keyframes ruleExpand': {
          from: { width: 0, opacity: 0 },
          to: { width: '180px', opacity: 1 },
        },
        animation: 'ruleExpand 0.8s ease 0.2s both',
      }} />

      {/* Title */}
      <Typography sx={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: '2.4rem',
        fontWeight: 700,
        letterSpacing: '0.28em',
        color: '#ede8d0',
        textTransform: 'uppercase',
        mb: 0.5,
        '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        animation: 'fadeIn 0.8s ease 0.4s both',
      }}>
        Sparky <Box component="span" sx={{ color: '#c9a84c' }}>Tool</Box>
      </Typography>

      <Typography sx={{
        fontFamily: '"Raleway", sans-serif',
        fontSize: '0.58rem',
        fontWeight: 400,
        letterSpacing: '0.4em',
        color: '#3a3428',
        textTransform: 'uppercase',
        mb: 5,
        animation: 'fadeIn 0.8s ease 0.5s both',
      }}>
        Analytics Platform
      </Typography>

      {/* Bottom rule */}
      <Box sx={{
        width: 180, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)',
        mb: 4,
        animation: 'fadeIn 0.8s ease 0.6s both',
      }} />

      {/* Status */}
      {isError ? (
        <Box sx={{ textAlign: 'center', animation: 'fadeIn 0.5s ease both' }}>
          <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.65rem', letterSpacing: '0.2em', color: '#8f4a4a', textTransform: 'uppercase', mb: 1 }}>
            System Offline
          </Typography>
          <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.75rem', color: '#3a3428', mb: 3, maxWidth: 320 }}>
            Cannot reach the backend. Make sure the server is running and try again.
          </Typography>
          <Button
            onClick={runCheck}
            variant="outlined"
            sx={{
              color: '#c9a84c', borderColor: 'rgba(201,168,76,0.3)',
              borderRadius: '1px',
              fontFamily: '"Raleway", sans-serif',
              fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.16em',
              '&:hover': { borderColor: '#c9a84c', bgcolor: 'rgba(201,168,76,0.04)' },
            }}
          >
            Retry Connection
          </Button>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', animation: 'fadeIn 0.8s ease 0.7s both' }}>
          <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.62rem', letterSpacing: '0.22em', color: '#3a3428', textTransform: 'uppercase', mb: 2 }}>
            Connecting to backend…
          </Typography>
          {/* Dot row loader */}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Box key={i} sx={{
                width: 3, height: 3, bgcolor: '#c9a84c',
                '@keyframes dotPulse': {
                  '0%,100%': { opacity: 0.1, transform: 'scaleY(1)' },
                  '50%': { opacity: 1, transform: 'scaleY(2)' },
                },
                animation: `dotPulse 1.4s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
