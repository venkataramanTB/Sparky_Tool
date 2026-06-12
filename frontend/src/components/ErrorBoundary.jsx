import { Component } from 'react'
import { Box, Typography, Button } from '@mui/material'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, stack: null, copied: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ stack: info.componentStack })
  }

  copyDetails() {
    const msg = this.state.error?.message || String(this.state.error)
    const text = `Error: ${msg}\n\nComponent stack:${this.state.stack || ''}`
    navigator.clipboard.writeText(text).catch(() => {})
    this.setState({ copied: true })
    setTimeout(() => this.setState({ copied: false }), 2000)
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error?.message || String(this.state.error)

    return (
      <Box role="alert" sx={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: 'background.default', px: 4, textAlign: 'center',
      }}>
        <Box sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'error.main', opacity: 0.4, display: 'grid', placeItems: 'center', mb: 3 }}>
          <Typography sx={{ color: 'error.main', fontSize: '1.2rem', fontWeight: 700 }} aria-hidden="true">!</Typography>
        </Box>
        <Typography component="h1" sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.5rem', fontWeight: 600, color: 'text.primary', mb: 1 }}>
          Something went wrong
        </Typography>
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', color: 'text.secondary', mb: 3, maxWidth: 520, wordBreak: 'break-word' }}>
          {msg}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            onClick={() => { this.setState({ error: null, stack: null }); window.location.reload() }}
            variant="outlined"
            color="primary"
            sx={{ borderRadius: '1px', fontFamily: '"Raleway"', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.14em' }}
          >
            Reload page
          </Button>
          <Button
            onClick={() => this.copyDetails()}
            variant="text"
            color="inherit"
            sx={{ borderRadius: '1px', fontFamily: '"Raleway"', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.14em', color: 'text.disabled' }}
          >
            {this.state.copied ? 'Copied!' : 'Copy details'}
          </Button>
        </Box>
      </Box>
    )
  }
}
