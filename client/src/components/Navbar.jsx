import { NavLink } from 'react-router-dom'
import { C } from '../tokens'

const LeafIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={C.green} style={{ flexShrink: 0 }}>
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
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: C.bg1,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '0 24px',
        height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <LeafIcon />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>
            GreenhouseGuardians
          </span>
        </div>

        {/* Nav links
            All tabs always fontWeight:500 so text width never changes on activation.
            Active state is communicated only via color + bottom border. */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                height: '100%',
                padding: '0 10px',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,           // always 500 — prevents text-width reflow
                color: isActive ? C.t1 : C.t3,
                borderBottom: isActive ? `2px solid ${C.green}` : '2px solid transparent',
                marginBottom: -1,          // sit flush against nav border
                transition: 'color 0.14s',
                whiteSpace: 'nowrap',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
