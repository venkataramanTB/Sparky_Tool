import { Component } from 'react'
import { Box, Typography, Button } from '@mui/material'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error?.message || String(this.state.error)

    return (
      <Box sx={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: '#0b0c0e', px: 4, textAlign: 'center',
      }}>
        <Box sx={{ width: 40, height: 40, border: '1px solid rgba(143,74,74,0.4)', display: 'grid', placeItems: 'center', mb: 3 }}>
          <Typography sx={{ color: '#8f4a4a', fontSize: '1.2rem', fontWeight: 700 }}>!</Typography>
        </Box>
        <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.5rem', fontWeight: 600, color: '#ede8d0', mb: 1 }}>
          Something went wrong
        </Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', color: '#5a5040', mb: 3, maxWidth: 520, wordBreak: 'break-word' }}>
          {msg}
        </Typography>
        <Button
          onClick={() => { this.setState({ error: null }); window.location.reload() }}
          variant="outlined"
          sx={{ color: '#c9a84c', borderColor: 'rgba(201,168,76,0.3)', borderRadius: '1px', fontFamily: '"Raleway"', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.14em' }}
        >
          Reload page
        </Button>
      </Box>
    )
  }
}
