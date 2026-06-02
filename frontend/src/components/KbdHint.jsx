import { Box } from '@mui/material'

export const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
export const MOD    = IS_MAC ? '⌘' : 'Ctrl'

export default function KbdHint({ keys, sx = {} }) {
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, flexShrink: 0, ...sx }}
    >
      {keys.split('+').map((k) => (
        <Box key={k} component="kbd" sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.48rem',
          color: 'text.disabled',
          bgcolor: 'rgba(128,128,128,0.07)',
          border: '1px solid', borderColor: 'divider',
          borderRadius: '2px',
          px: 0.55, py: 0.1,
          lineHeight: 1.6,
          userSelect: 'none',
          display: 'inline-block',
        }}>
          {k}
        </Box>
      ))}
    </Box>
  )
}
