/**
 * getDataGridSx(accent, mode)
 *
 * Returns an MUI `sx` object that themes a DataGrid to match the app's
 * dark/light palette — accent borders, Raleway headers, transparent rows.
 *
 * Usage:
 *   <DataGrid sx={getDataGridSx(accent, mode)} ... />
 */
export function getDataGridSx(accent, mode) {
  const dark = mode === 'dark'
  const border   = dark ? `${accent}1a` : `${accent}22`
  const cellLine = dark ? `${accent}12` : `${accent}1c`

  return {
    border: `1px solid ${border}`,
    borderRadius: '2px',
    fontFamily: '"Raleway", sans-serif',
    bgcolor: 'background.paper',

    // ── header ─────────────────────────────────────────────────────────
    '& .MuiDataGrid-columnHeaders': {
      bgcolor: 'background.default',
      borderBottom: `1px solid ${border}`,
    },
    '& .MuiDataGrid-columnHeader': {
      '&:focus, &:focus-within': { outline: 'none' },
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontFamily: '"Raleway", sans-serif',
      fontSize: '0.57rem',
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'text.secondary',
    },
    '& .MuiDataGrid-columnSeparator': { color: border },
    '& .MuiDataGrid-sortIcon':         { color: accent, fontSize: 14 },
    '& .MuiDataGrid-menuIconButton':    { color: 'text.disabled' },

    // ── cells ───────────────────────────────────────────────────────────
    '& .MuiDataGrid-cell': {
      borderColor: cellLine,
      fontFamily:  '"Raleway", sans-serif',
      fontSize:    '0.74rem',
      color:       'text.primary',
      display:     'flex',
      alignItems:  'center',
      '&:focus, &:focus-within': { outline: 'none' },
    },

    // ── rows ────────────────────────────────────────────────────────────
    '& .MuiDataGrid-row': {
      '&:hover':         { bgcolor: `${accent}08` },
      '&.Mui-selected':  { bgcolor: `${accent}10`, '&:hover': { bgcolor: `${accent}14` } },
    },

    // ── footer / pagination ─────────────────────────────────────────────
    '& .MuiDataGrid-footerContainer': {
      borderTop: `1px solid ${border}`,
      bgcolor:   'background.default',
    },
    '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
      fontFamily: '"Raleway", sans-serif',
      fontSize:   '0.65rem',
      color:      'text.secondary',
    },

    // ── overlay (empty state) ───────────────────────────────────────────
    '& .MuiDataGrid-overlay':       { bgcolor: 'background.paper' },
    '& .MuiDataGrid-virtualScroller': { bgcolor: 'background.paper' },
  }
}
