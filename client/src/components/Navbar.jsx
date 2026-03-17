import { useState } from 'react'
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
  { to: '/timeline', label: 'Timeline' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

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
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
          <LeafIcon />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px' }}>
            GreenhouseGuardians
          </span>
        </NavLink>

        {/* Desktop nav links */}
        <div className="nav-links-wrap" style={{ alignItems: 'center', height: '100%' }}>
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
                fontWeight: 500,
                color: isActive ? C.t1 : C.t3,
                borderBottom: isActive ? `2px solid ${C.green}` : '2px solid transparent',
                marginBottom: -1,
                transition: 'color 0.14s',
                whiteSpace: 'nowrap',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="nav-ham"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{
          background: C.bg1,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '13px 24px',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? C.green : C.t2,
                borderLeft: isActive ? `3px solid ${C.green}` : '3px solid transparent',
                background: isActive ? C.greenDim : 'transparent',
                transition: 'color 0.14s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  )
}
