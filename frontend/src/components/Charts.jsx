import { Paper, Typography, Box } from '@mui/material'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'

const PALETTE = ['#c9a84c', '#ede8d0', '#7a7060', '#5a5040', '#a89060', '#d4b870']

const tooltipStyle = {
  contentStyle: {
    background: '#111316',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 1,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 12,
    color: '#ede8d0',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  labelStyle: { color: '#7a7060', letterSpacing: '0.06em' },
  cursor: { fill: 'rgba(201,168,76,0.03)' },
}

const axisStyle = {
  tick: { fill: '#3a3428', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' },
  axisLine: { stroke: 'rgba(201,168,76,0.08)' },
  tickLine: { stroke: 'rgba(201,168,76,0.08)' },
}

function ChartPanel({ title, tag, delay = 0, children }) {
  return (
    <Paper sx={{
      background: '#111316',
      border: '1px solid rgba(201,168,76,0.1)',
      borderRadius: '1px',
      p: 3,
      '@keyframes chartEnter': {
        from: { opacity: 0, transform: 'translateY(12px)' },
        to:   { opacity: 1, transform: 'translateY(0)' },
      },
      animation: 'chartEnter 0.5s cubic-bezier(0.16,1,0.3,1) both',
      animationDelay: `${delay}ms`,
      transition: 'border-color 0.25s ease',
      '&:hover': { borderColor: 'rgba(201,168,76,0.2)' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 1, height: 20, background: 'linear-gradient(180deg, #c9a84c 0%, rgba(201,168,76,0.1) 100%)' }} />
          <Typography sx={{
            fontFamily: '"Cormorant Garamond", serif',
            fontWeight: 600,
            fontSize: '1.1rem',
            letterSpacing: '0.04em',
            color: '#ede8d0',
          }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{
          px: 1.2, py: 0.3,
          border: '1px solid rgba(201,168,76,0.2)',
          fontSize: '0.55rem',
          letterSpacing: '0.2em',
          color: '#5a5040',
          fontFamily: '"Raleway", sans-serif',
          fontWeight: 700,
        }}>
          {tag}
        </Box>
      </Box>
      {children}
    </Paper>
  )
}

const renderPieLabel = ({ name, percent, x, y }) => (
  <text x={x} y={y} fill="#5a5040" fontSize={10} textAnchor="middle" dominantBaseline="central"
    fontFamily='"JetBrains Mono", monospace'>
    {`${name} ${(percent * 100).toFixed(0)}%`}
  </text>
)

export default function Charts({ kpis }) {
  const numeric     = Object.entries(kpis).filter(([, v]) => v.type === 'numeric')
  const categorical = Object.entries(kpis).filter(([, v]) => v.type === 'categorical')

  const barData = numeric.map(([col, s]) => ({
    name: col,
    Mean: parseFloat(s.mean.toFixed(2)),
    Min:  parseFloat(s.min.toFixed(2)),
    Max:  parseFloat(s.max.toFixed(2)),
  }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {barData.length > 0 && (
        <ChartPanel title="Numeric Summary" tag="BAR CHART" delay={0}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.05)" vertical={false} />
              <XAxis dataKey="name" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontFamily: '"Raleway", sans-serif', fontSize: 11, color: '#5a5040', paddingTop: 12 }} />
              <Bar dataKey="Mean" fill="#c9a84c" radius={[2,2,0,0]} />
              <Bar dataKey="Min"  fill="#5a5040" radius={[2,2,0,0]} />
              <Bar dataKey="Max"  fill="#ede8d0" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}

      {categorical.map(([col, stats], i) => {
        const pieData = Object.entries(stats.value_counts).map(([name, value]) => ({ name, value }))
        return (
          <ChartPanel key={col} title={`${col} — Distribution`} tag="PIE CHART" delay={(i + 1) * 100}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={110}
                  innerRadius={50}
                  paddingAngle={3}
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>
        )
      })}
    </Box>
  )
}
