import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Box, Typography } from '@mui/material'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import { AuthProvider } from './AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#c9a84c', dark: '#8a6428', light: '#e8c96a' },
    secondary:  { main: '#7a7060' },
    background: { default: '#0b0c0e', paper: '#111316' },
    text:       { primary: '#ede8d0', secondary: '#7a7060', disabled: '#3a3428' },
    divider:    'rgba(201,168,76,0.1)',
    success:    { main: '#6b8f71' },
    error:      { main: '#8f4a4a' },
    warning:    { main: '#c9a84c' },
  },
  typography: {
    fontFamily: '"Raleway", "Cormorant Garamond", serif',
    h3: { fontFamily: '"Cormorant Garamond", serif', fontWeight: 700 },
    h4: { fontFamily: '"Cormorant Garamond", serif', fontWeight: 600 },
    h5: { fontFamily: '"Cormorant Garamond", serif', fontWeight: 600 },
    h6: { fontFamily: '"Cormorant Garamond", serif', fontWeight: 600 },
    button: { fontFamily: '"Raleway", sans-serif', fontWeight: 700, letterSpacing: '0.1em' },
  },
  shape: { borderRadius: 1 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 2, backgroundImage: 'none', border: '1px solid rgba(201,168,76,0.08)' },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { borderRadius: 2, backgroundImage: 'none' } },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 1, textTransform: 'none', fontWeight: 700, letterSpacing: '0.1em' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 2,
          border: '1px solid rgba(201,168,76,0.18)',
          backgroundImage: 'none',
          background: '#111316',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: 'rgba(201,168,76,0.07)', fontFamily: '"Raleway", sans-serif' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: 'rgba(201,168,76,0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(201,168,76,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#c9a84c' },
          },
          '& .MuiInputLabel-root': { color: '#7a7060' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#c9a84c' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.2)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.4)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#c9a84c' },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 2, fontFamily: '"Raleway", sans-serif' },
      },
    },
  },
})

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ''
const clerkAppearance = {
  theme: 'dark',
  variables: {
    colorPrimary: '#c9a84c',
    colorPrimaryForeground: '#111316',
    colorBackground: '#111316',
    colorForeground: '#ede8d0',
    colorNeutral: '#2b2f37',
    colorMuted: '#7a7060',
    colorInput: '#16181d',
    colorInputForeground: '#ede8d0',
    colorBorder: 'rgba(201,168,76,0.18)',
    colorRing: '#c9a84c',
    colorModalBackdrop: 'rgba(0, 0, 0, 0.75)',
    fontFamily: 'Raleway, Cormorant Garamond, serif',
    borderRadius: '0.75rem',
    spacing: '1rem',
  },
  layout: {
    logoPlacement: 'inside',
  },
  elements: {
    card: {
      borderRadius: '1rem',
      backgroundColor: '#111316',
      boxShadow: '0 24px 80px rgba(0, 0, 0, 0.48)',
    },
    formButtonPrimary: {
      borderRadius: '0.75rem',
      backgroundColor: '#c9a84c',
      color: '#111316',
    },
    formButtonPrimary__hover: {
      backgroundColor: '#d6bd64',
    },
    formButtonReset: {
      color: '#c9a84c',
    },
    formFieldInput: {
      backgroundColor: '#141619',
      borderColor: 'rgba(201,168,76,0.16)',
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {clerkPublishableKey ? (
        <ErrorBoundary>
          <ClerkProvider publishableKey={clerkPublishableKey} appearance={clerkAppearance}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ClerkProvider>
        </ErrorBoundary>
      ) : (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0b0c0e', px: 4 }}>
          <Box sx={{ maxWidth: 680, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 700, color: '#ede8d0', mb: 2 }}>Clerk configuration required</Typography>
            <Typography sx={{ color: '#7a7060', lineHeight: 1.8 }}>
              No Clerk publishable key was found. Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>frontend/.env</code> and restart the dev server.
            </Typography>
          </Box>
        </Box>
      )}
    </ThemeProvider>
  </React.StrictMode>
)
