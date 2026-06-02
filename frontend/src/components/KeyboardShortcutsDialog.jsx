import { Dialog, DialogContent, Box, Typography, Grid } from '@mui/material'
import { useThemeContext } from '../ThemeContext'
import KbdHint, { MOD } from './KbdHint'

const SECTIONS = [
  {
    title: 'Navigation  (G then …)',
    rows: [
      ['G → D', 'Dashboard'],
      ['G → C', 'Configuration'],
      ['G → H', 'Schedules'],
      ['G → A', 'Admin'],
      ['G → P', 'Preferences'],
    ],
  },
  {
    title: 'Dashboard',
    rows: [
      ['R', 'Run current config'],
      ['1 – 4', 'Switch tabs'],
      ['P', 'Download PDF'],
      ['C', 'Compare runs'],
      ['V', 'Toggle table / card view'],
    ],
  },
  {
    title: 'AI Analysis',
    rows: [
      [`${MOD}+O`, 'Open file browser'],
      [`${MOD}+D`, 'Download PDF'],
      [`${MOD}+↵`, 'Re-run same file'],
      ['Esc', 'Reset results'],
    ],
  },
  {
    title: 'Configuration',
    rows: [
      [`${MOD}+S`, 'Save configuration'],
      ['N', 'New configuration'],
      [`${MOD}+Del`, 'Delete configuration'],
    ],
  },
  {
    title: 'Schedules',
    rows: [
      ['N', 'New schedule'],
      [`${MOD}+S`, 'Save (dialog)'],
      ['Esc', 'Close dialog'],
    ],
  },
  {
    title: 'Admin',
    rows: [
      ['R', 'Reload data'],
      ['1 – 9', 'Switch tabs'],
      ['N', 'New item (context)'],
      ['F', 'Focus search'],
      ['Esc', 'Close dialog'],
    ],
  },
  {
    title: 'Preferences',
    rows: [
      [`${MOD}+S`, 'Save preferences'],
      [`${MOD}+Shift+R`, 'Reset to defaults'],
    ],
  },
  {
    title: 'Global',
    rows: [
      ['?', 'Show this cheatsheet'],
    ],
  },
]

export default function KeyboardShortcutsDialog({ open, onClose }) {
  const { accent } = useThemeContext()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ height: 2, background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, ${accent}dd 70%, transparent 100%)` }} />

      <DialogContent sx={{ p: 0 }}>
        {/* header */}
        <Box sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
          <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 700, fontSize: '1.6rem', color: 'text.primary', lineHeight: 1 }}>
            Keyboard Shortcuts
          </Typography>
          <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.62rem', color: 'text.disabled', letterSpacing: '0.12em' }}>
            press ? anywhere to toggle
          </Typography>
        </Box>

        {/* grid of sections */}
        <Box sx={{ px: 3.5, py: 3 }}>
          <Grid container spacing={3}>
            {SECTIONS.map(({ title, rows }) => (
              <Grid item xs={12} sm={6} md={4} key={title}>
                <Typography sx={{
                  fontFamily: '"Raleway", sans-serif', fontWeight: 700,
                  fontSize: '0.57rem', letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: accent,
                  mb: 1.25, pb: 0.75,
                  borderBottom: `1px solid ${accent}25`,
                }}>
                  {title}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {rows.map(([keys, label]) => (
                    <Box key={keys} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                      <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem', color: 'text.secondary' }}>
                        {label}
                      </Typography>
                      <KbdHint keys={keys} sx={{ flexShrink: 0 }} />
                    </Box>
                  ))}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
