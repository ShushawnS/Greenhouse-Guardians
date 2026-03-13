import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import ChartCard from '../components/ChartCard'

const PLACEHOLDER = [
  { t: 'Week 1' }, { t: 'Week 2' }, { t: 'Week 3' },
  { t: 'Week 4' }, { t: 'Week 5' }, { t: 'Week 6' },
]

export default function Trends() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-800">Trends</h1>
        <p className="text-sm text-gray-500 mt-1">Track flowers and tomatoes over time</p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-green-800">Trends coming soon</p>
          <p className="text-sm text-green-700 mt-0.5">Track flowers and tomatoes over time \u2014 upload data regularly to enable trend analysis.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Flowers over time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={PLACEHOLDER} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #d1fae5', fontSize: 12 }} />
              <Line type="monotone" dataKey="flowers" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="6 4" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-center text-gray-400 mt-2">No data yet \u2014 upload images over multiple sessions to see trends</p>
        </ChartCard>

        <ChartCard title="Tomatoes over time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={PLACEHOLDER} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #d1fae5', fontSize: 12 }} />
              <Line type="monotone" dataKey="tomatoes" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 4" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-center text-gray-400 mt-2">No data yet \u2014 upload images over multiple sessions to see trends</p>
        </ChartCard>
      </div>
    </div>
  )
}
