export default function StatCard({ title, value, subtitle, breakdown, accent = 'green' }) {
  return (
    <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <p className="text-3xl font-bold text-green-800 mb-2">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mb-3">{subtitle}</p>}
      {breakdown && (
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-gray-100">
          {breakdown.map(({ label, count, color }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-gray-600">{label}</span>
              </div>
              <span className="font-semibold text-gray-800">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
