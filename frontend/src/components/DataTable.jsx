import { useState, useMemo } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table'
import {
  Box, Typography, TextField, InputAdornment, IconButton, Select, MenuItem,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import LastPageIcon from '@mui/icons-material/LastPage'

export default function DataTable({ rows, columns }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])

  const columnDefs = useMemo(() => columns.map(col => ({ accessorKey: col, header: col })), [columns])

  const table = useReactTable({
    data: rows, columns: columnDefs,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()
  const from = pageIndex * pageSize + 1
  const to = Math.min(from + pageSize - 1, filteredCount)

  return (
    <Box sx={{
      background: '#111316',
      border: '1px solid rgba(201,168,76,0.1)',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, py: 2,
        borderBottom: '1px solid rgba(201,168,76,0.08)',
      }}>
        <TextField
          size="small"
          placeholder="Search records…"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 15, color: '#3a3428' }} />
              </InputAdornment>
            ),
            sx: {
              fontFamily: '"Raleway", sans-serif',
              fontSize: '0.82rem',
              color: '#ede8d0',
              '& input::placeholder': { color: '#3a3428', opacity: 1 },
            },
          }}
          sx={{
            width: 280,
            '& .MuiOutlinedInput-root': {
              borderRadius: '1px',
              bgcolor: 'rgba(201,168,76,0.02)',
              '& fieldset': { borderColor: 'rgba(201,168,76,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(201,168,76,0.3)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(201,168,76,0.5)' },
            },
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {globalFilter && (
            <Typography sx={{ fontSize: '0.68rem', color: '#c9a84c', letterSpacing: '0.1em', fontFamily: '"JetBrains Mono", monospace' }}>
              {filteredCount} match{filteredCount !== 1 ? 'es' : ''}
            </Typography>
          )}
          <Typography sx={{ fontSize: '0.6rem', color: '#3a3428', letterSpacing: '0.2em', fontFamily: '"Raleway", sans-serif', fontWeight: 700 }}>
            {rows.length.toLocaleString()} RECORDS
          </Typography>
        </Box>
      </Box>

      {/* Table */}
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
                  const sorted = h.column.getIsSorted()
                  return (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        background: 'rgba(201,168,76,0.03)',
                        borderBottom: '1px solid rgba(201,168,76,0.12)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          letterSpacing: '0.2em',
                          color: sorted ? '#c9a84c' : '#5a5040',
                          fontFamily: '"Raleway", sans-serif',
                          textTransform: 'uppercase',
                          transition: 'color 0.15s ease',
                        }}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </Typography>
                        {sorted === 'asc'  ? <ArrowUpwardIcon   sx={{ fontSize: 10, color: '#c9a84c' }} />
                         : sorted === 'desc' ? <ArrowDownwardIcon sx={{ fontSize: 10, color: '#c9a84c' }} />
                         : <UnfoldMoreIcon sx={{ fontSize: 10, color: '#3a3428', opacity: 0.5 }} />}
                      </Box>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, ri) => (
              <tr
                key={row.id}
                style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(201,168,76,0.015)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'transparent' : 'rgba(201,168,76,0.015)'}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    style={{
                      padding: '8px 14px',
                      borderBottom: '1px solid rgba(201,168,76,0.05)',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.78rem',
                      color: '#7a7060',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {String(cell.getValue() ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {/* Pagination */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, py: 1.5,
        borderTop: '1px solid rgba(201,168,76,0.08)',
      }}>
        <Typography sx={{ fontSize: '0.65rem', color: '#3a3428', fontFamily: '"JetBrains Mono", monospace' }}>
          {filteredCount > 0 ? `${from}–${to} of ${filteredCount.toLocaleString()}` : '0 results'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.58rem', color: '#3a3428', fontFamily: '"Raleway", sans-serif', letterSpacing: '0.16em', fontWeight: 700 }}>
            ROWS
          </Typography>
          <Select
            value={pageSize}
            onChange={e => { table.setPageSize(+e.target.value); table.setPageIndex(0) }}
            size="small"
            sx={{
              fontSize: '0.72rem', fontFamily: '"JetBrains Mono", monospace',
              color: '#7a7060', height: 26, borderRadius: '1px',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.15)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.3)' },
              '& .MuiSelect-icon': { color: '#3a3428' },
            }}
          >
            {[10, 20, 50, 100].map(n => (
              <MenuItem key={n} value={n} sx={{ fontSize: '0.72rem', fontFamily: '"JetBrains Mono", monospace' }}>{n}</MenuItem>
            ))}
          </Select>

          <Box sx={{ display: 'flex', gap: 0.25, ml: 0.5 }}>
            {[
              { icon: <FirstPageIcon sx={{ fontSize: 15 }} />, action: () => table.setPageIndex(0), disabled: !table.getCanPreviousPage() },
              { icon: <ChevronLeftIcon sx={{ fontSize: 15 }} />, action: () => table.previousPage(), disabled: !table.getCanPreviousPage() },
              { icon: <ChevronRightIcon sx={{ fontSize: 15 }} />, action: () => table.nextPage(), disabled: !table.getCanNextPage() },
              { icon: <LastPageIcon sx={{ fontSize: 15 }} />, action: () => table.setPageIndex(pageCount - 1), disabled: !table.getCanNextPage() },
            ].map(({ icon, action, disabled }, i) => (
              <IconButton
                key={i}
                onClick={action}
                disabled={disabled}
                size="small"
                sx={{
                  width: 26, height: 26, borderRadius: '1px',
                  color: disabled ? '#3a3428' : '#5a5040',
                  border: '1px solid rgba(201,168,76,0.1)',
                  '&:hover:not(:disabled)': {
                    color: '#c9a84c',
                    bgcolor: 'rgba(201,168,76,0.06)',
                    borderColor: 'rgba(201,168,76,0.3)',
                  },
                  transition: 'all 0.15s ease',
                }}
              >
                {icon}
              </IconButton>
            ))}
          </Box>

          <Typography sx={{ fontSize: '0.65rem', color: '#3a3428', fontFamily: '"JetBrains Mono", monospace', ml: 0.5 }}>
            {pageIndex + 1} / {pageCount}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
