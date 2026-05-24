import { Box, Typography } from '@mui/material'
import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
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
      {/* Subtle diagonal pattern */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(135deg, rgba(201,168,76,0.012) 0px, rgba(201,168,76,0.012) 1px, transparent 1px, transparent 60px)',
      }} />

      {/* Corner marks */}
      {[
        { top: 24, left: 24, borderTop: '1px solid', borderLeft: '1px solid' },
        { top: 24, right: 24, borderTop: '1px solid', borderRight: '1px solid' },
        { bottom: 24, left: 24, borderBottom: '1px solid', borderLeft: '1px solid' },
        { bottom: 24, right: 24, borderBottom: '1px solid', borderRight: '1px solid' },
      ].map((s, i) => (
        <Box key={i} sx={{ position: 'absolute', width: 20, height: 20, borderColor: 'rgba(201,168,76,0.18)', ...s }} />
      ))}

      <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', mb: 5 }}>
        <Typography sx={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '0.28em',
          color: '#c9a84c',
          textTransform: 'uppercase',
          mb: 0.5,
        }}>
          Sparky Tool
        </Typography>
        <Box sx={{ height: '1px', width: 120, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)', mx: 'auto', mb: 0.5 }} />
        <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.55rem', letterSpacing: '0.35em', color: '#3a3428', textTransform: 'uppercase' }}>
          Analytics Platform
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, px: 2 }}>
        <SignIn routing="virtual" />
      </Box>
    </Box>
  )
}
