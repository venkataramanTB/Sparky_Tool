import { render, screen, fireEvent } from '@testing-library/react'
import DataTable from './DataTable'

const rows = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
]
const columns = ['name', 'age']

test('renders all rows', () => {
  render(<DataTable rows={rows} columns={columns} />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
  expect(screen.getByText('Charlie')).toBeInTheDocument()
})

test('renders column headers', () => {
  render(<DataTable rows={rows} columns={columns} />)
  expect(screen.getByText('name')).toBeInTheDocument()
  expect(screen.getByText('age')).toBeInTheDocument()
})

test('filters rows on search input', () => {
  render(<DataTable rows={rows} columns={columns} />)
  const search = screen.getByPlaceholderText('Search...')
  fireEvent.change(search, { target: { value: 'Alice' } })
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.queryByText('Bob')).not.toBeInTheDocument()
})

test('shows row count', () => {
  render(<DataTable rows={rows} columns={columns} />)
  expect(screen.getByText(/3 rows/i)).toBeInTheDocument()
})
