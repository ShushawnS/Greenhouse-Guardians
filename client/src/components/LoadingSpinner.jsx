import { C } from '../tokens'

export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 24px' }}>
      <div style={{
        width: 28, height: 28,
        border: `2px solid ${C.border2}`,
        borderTopColor: C.green,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 12, color: C.t3 }}>{message}</p>
    </div>
  )
}
