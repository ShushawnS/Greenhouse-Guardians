import { NavLink } from 'react-router-dom'

const LeafIcon = () => (
  <svg className="w-7 h-7 text-green-600" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2 2-4 8-3 8-3-3.37-3.37-9-3-11 1z"/>
  </svg>
)

const links = [
  { to: '/',         label: 'Dashboard' },
  { to: '/classify', label: 'Classify & Upload' },
  { to: '/rows',     label: 'Row Details' },
  { to: '/trends',   label: 'Trends' },
  { to: '/ayush',    label: 'Ayush Testing' },
]

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-green-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LeafIcon />
          <span className="text-lg font-bold text-green-800 tracking-tight">
            GreenhouseGuardians
          </span>
        </div>
        <div className="flex items-center gap-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'text-green-700 bg-green-50 border-b-2 border-green-500'
                    : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
