import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'

export default function DataTable({ rows, columns }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])

  const columnDefs = useMemo(
    () => columns.map(col => ({ accessorKey: col, header: col })),
    [columns]
  )

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <input
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search..."
          style={{ padding: '0.4rem', borderRadius: 4, border: '1px solid #ccc', width: 240 }}
        />
        <span style={{ color: '#666' }}>{table.getFilteredRowModel().rows.length} rows</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', cursor: 'pointer', userSelect: 'none' }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} style={{ padding: '0.5rem' }}>
                    {String(cell.getValue() ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>←</button>
        <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>→</button>
      </div>
    </div>
  )
}
