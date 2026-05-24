import { render, screen } from '@testing-library/react'
import KPICards from './KPICards'

const kpis = {
  age: { type: 'numeric', count: 3, sum: 90, mean: 30, min: 25, max: 35 },
  name: { type: 'categorical', count: 3, unique_count: 3, value_counts: { Alice: 1 } }
}

test('renders a card for each numeric column', () => {
  render(<KPICards kpis={kpis} />)
  expect(screen.getByText('age')).toBeInTheDocument()
})

test('shows count, sum, avg, min, max for numeric columns', () => {
  render(<KPICards kpis={kpis} />)
  // New design: label and value are separate elements; avg is the large hero number
  expect(screen.getByText('3')).toBeInTheDocument()       // count
  expect(screen.getByText('90.00')).toBeInTheDocument()   // sum
  expect(screen.getByText('30.00')).toBeInTheDocument()   // avg (hero)
  // min/max appear in both the range bar labels and the colored boxes
  expect(screen.getAllByText('25.00').length).toBeGreaterThan(0)
  expect(screen.getAllByText('35.00').length).toBeGreaterThan(0)
})

test('does not render categorical columns as KPI cards', () => {
  render(<KPICards kpis={kpis} />)
  expect(screen.queryByText('name')).not.toBeInTheDocument()
})
