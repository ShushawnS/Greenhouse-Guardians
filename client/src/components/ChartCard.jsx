export default function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-green-100 rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-green-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}
