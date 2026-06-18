import { Component } from 'react'
import { Box, Typography, Button, Stack } from '@mui/material'

function _genId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase()
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorId: null }
    this._retry = this._retry.bind(this)
    this._reload = this._reload.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error, errorId: _genId() }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  _retry() {
    this.setState({ error: null, errorId: null })
  }

  _reload() {
    this.setState({ error: null, errorId: null })
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg     = this.state.error?.message || String(this.state.error)
    const errorId = this.state.errorId

    return (
      <Box
        role="alert"
        aria-live="assertive"
        sx={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          bgcolor: 'background.default', px: 4, textAlign: 'center',
        }}
      >
        <Box sx={{
          width: 40, height: 40, border: '1px solid', borderColor: 'error.main',
          opacity: 0.4, display: 'grid', placeItems: 'center', mb: 3,
        }}>
          <Typography sx={{ color: 'error.main', fontSize: '1.2rem', fontWeight: 700 }}>!</Typography>
        </Box>

        <Typography sx={{
          fontFamily: '"Cormorant Garamond", serif', fontSize: '1.5rem',
          fontWeight: 600, color: 'text.primary', mb: 1,
        }}>
          Something went wrong
        </Typography>

        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem',
          color: 'text.secondary', mb: 1, maxWidth: 520, wordBreak: 'break-word',
        }}>
          {msg}
        </Typography>

        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem',
          color: 'text.disabled', mb: 3,
        }}>
          Error ID: {errorId}
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button
            onClick={this._retry}
            variant="outlined"
            color="primary"
            aria-label="Try rendering this section again without reloading the page"
            sx={{ borderRadius: '1px', fontFamily: '"Raleway"', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.14em' }}
          >
            Try again
          </Button>
          <Button
            onClick={this._reload}
            variant="outlined"
            color="inherit"
            aria-label="Reload the entire page"
            sx={{ borderRadius: '1px', fontFamily: '"Raleway"', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.14em', opacity: 0.6 }}
          >
            Reload page
          </Button>
        </Stack>
      </Box>
    )
  }
}
