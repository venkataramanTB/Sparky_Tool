import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import TableRowsIcon from '@mui/icons-material/TableRows'
import GridViewIcon  from '@mui/icons-material/GridView'

/**
 * ViewToggle — small icon toggle between 'table' (DataGrid) and 'cards' view.
 * Props:
 *   value    — 'table' | 'cards'
 *   onChange — (newValue: 'table' | 'cards') => void
 */
export default function ViewToggle({ value, onChange }) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, v) => v && onChange(v)}
      size="small"
      sx={{
        '& .MuiToggleButton-root': {
          px: 0.9, py: 0.35,
          border: '1px solid',
          borderColor: 'divider',
          color: 'text.disabled',
          borderRadius: '2px !important',
          transition: 'all 0.15s ease',
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color:   'background.default',
            borderColor: 'primary.main',
            '&:hover': { bgcolor: 'primary.dark' },
          },
          '&:hover:not(.Mui-selected)': { bgcolor: 'action.hover', color: 'text.secondary' },
        },
      }}
    >
      <Tooltip title="Table view" arrow placement="top">
        <ToggleButton value="table" aria-label="table view">
          <TableRowsIcon sx={{ fontSize: 15 }} />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Card view" arrow placement="top">
        <ToggleButton value="cards" aria-label="card view">
          <GridViewIcon sx={{ fontSize: 15 }} />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  )
}
