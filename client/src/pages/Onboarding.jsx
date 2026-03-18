import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '../tokens'
import { saveGreenhouseConfig } from '../hooks/useGreenhouseConfig'

/* ─────────────────────────────────────────────
   Shared styles
───────────────────────────────────────────── */
const btnPrimary = {
  display: 'block',
  padding: '11px 20px',
  background: C.green, color: '#fff',
  border: 'none', borderRadius: 9,
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  letterSpacing: '-0.1px',
}

const btnSecondary = {
  padding: '11px 20px',
  background: C.bg3, color: C.t2,
  border: `1px solid ${C.border}`,
  borderRadius: 9, fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}


const stepWrap = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', padding: '40px 24px',
}

/* Card matching the dashboard card style */
const outerCard = {
  background: C.bg1,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '28px 28px',
  width: '100%',
  maxWidth: 500,
}

const stepLabel = {
  fontSize: 11, fontWeight: 600, color: C.t3,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  marginBottom: 6,
}

const stepTitle = {
  fontSize: 22, fontWeight: 700, color: C.t1,
  letterSpacing: '-0.4px', lineHeight: 1.25,
  margin: 0,
}

/* ─────────────────────────────────────────────
   Leaf icon — same as Navbar
───────────────────────────────────────────── */
const LeafIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={C.green}>
    <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2 2-4 8-3 8-3-3.37-3.37-9-3-11 1z"/>
  </svg>
)

/* ─────────────────────────────────────────────
   Step 2 icons
───────────────────────────────────────────── */
const IconRows = () => (
  <svg width="36" height="36" viewBox="0 0 38 38" fill="none" style={{ flexShrink: 0 }}>
    <rect x="3"  y="7" width="5" height="20" rx="1.5" fill={C.bg4} />
    <rect x="11" y="7" width="5" height="20" rx="1.5" fill={C.bg4} />
    <rect x="19" y="7" width="5" height="20" rx="1.5" fill={C.bg4} />
    <rect x="27" y="7" width="5" height="20" rx="1.5" fill={C.bg4} />
    <circle cx="32" cy="33" r="3" fill={C.green} />
    <path d="M22 33 H28" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M26 30 L29 33 L26 36" stroke={C.green} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
  </svg>
)

const IconCamera = () => (
  <svg width="36" height="36" viewBox="0 0 38 38" fill="none" style={{ flexShrink: 0 }}>
    <rect x="3" y="12" width="32" height="20" rx="3" stroke={C.t2} strokeWidth="1.8" fill="none" />
    <circle cx="19" cy="22" r="6" stroke={C.t2} strokeWidth="1.8" fill="none" />
    <circle cx="19" cy="22" r="2.5" fill={C.bg3} />
    <path d="M14 12 L16 8 H22 L24 12" stroke={C.t2} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
    <line x1="9"  y1="17" x2="6"  y2="14" stroke={C.green} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="9"  y1="22" x2="5"  y2="22" stroke={C.green} strokeWidth="1.2" strokeLinecap="round" />
    <line x1="9"  y1="27" x2="6"  y2="30" stroke={C.green} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

const IconChart = () => (
  <svg width="36" height="36" viewBox="0 0 38 38" fill="none" style={{ flexShrink: 0 }}>
    <rect x="4"  y="25" width="7" height="9"  rx="1.5" fill={C.unripe}   opacity="0.8" />
    <rect x="15" y="18" width="7" height="16" rx="1.5" fill={C.halfRipe} opacity="0.8" />
    <rect x="26" y="11" width="7" height="23" rx="1.5" fill={C.green}    opacity="0.9" />
    <line x1="2" y1="34" x2="36" y2="34" stroke={C.border2} strokeWidth="1.5" />
    <path d="M28 9 L32 5 M32 5 L36 9 M32 5 V15" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

const HOW_STEPS = [
  {
    num: '01',
    title: 'Push through rows',
    desc: 'A camera-equipped cart travels along each greenhouse row',
    Icon: IconRows,
  },
  {
    num: '02',
    title: 'Camera captures data',
    desc: 'A depth camera records flower and tomato images at each point',
    Icon: IconCamera,
  },
  {
    num: '03',
    title: 'Dashboard predicts yield',
    desc: 'AI classifies each image and forecasts harvest weight in real time',
    Icon: IconChart,
  },
]

/* ─────────────────────────────────────────────
   Progress bar — 3 segments for steps 2–4
───────────────────────────────────────────── */
function Progress({ active }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: 24 }}>
      {[1, 2, 3].map(s => (
        <div key={s} style={{
          height: 3, width: 36, borderRadius: 2,
          background: s <= active ? C.t1 : C.bg4,
          transition: 'background 0.25s',
        }} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Step 1 — Welcome
───────────────────────────────────────────── */
function StepWelcome({ onNext }) {
  return (
    <div className="step-in" style={{ ...stepWrap, textAlign: 'center' }}>
      <div style={{ ...outerCard, textAlign: 'center' }}>
        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
          <LeafIcon size={28} />
          <span style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: '-0.5px' }}>
            GreenhouseGuardians
          </span>
        </div>

        {/* Tagline */}
        <p style={{
          fontSize: 14, color: C.t2, lineHeight: 1.7,
          maxWidth: 360, margin: '0 auto 32px',
        }}>
          A computer vision system that tracks tomato flower stages to predict harvest yield.
        </p>

        <button onClick={onNext} className="btn-press" style={{ ...btnPrimary, width: '100%', padding: '13px 20px', fontSize: 14 }}>
          Get Started
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Step 2 — How it works
───────────────────────────────────────────── */
function StepHowItWorks({ onNext, onBack }) {
  return (
    <div className="step-in" style={stepWrap}>
      <div style={outerCard}>
        <Progress active={1} />

        <div style={{ marginBottom: 24 }}>
          <p style={stepLabel}>How it works</p>
          <h2 style={stepTitle}>From rows to results</h2>
        </div>

        {/* Vertical step list — matches dashboard card style */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {HOW_STEPS.map(({ num, title, desc, Icon }) => (
            <div key={num} style={{
              background: C.bg2,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <Icon />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, letterSpacing: '0.1em' }}>{num}</span>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 3, marginTop: 2, lineHeight: 1.3 }}>{title}</p>
                <p style={{ fontSize: 12, color: C.t2, lineHeight: 1.55, margin: 0 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBack} className="btn-press" style={btnSecondary}>Back</button>
          <button onClick={onNext} className="btn-press" style={{ ...btnPrimary, flex: 1 }}>Continue</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Step 3 — Configure greenhouse
───────────────────────────────────────────── */
function StepConfigure({ numRows, setNumRows, onNext, onBack }) {
  return (
    <div className="step-in" style={stepWrap}>
      <div style={outerCard}>
        <Progress active={2} />

        <div style={{ marginBottom: 24 }}>
          <p style={stepLabel}>Configure</p>
          <h2 style={{ ...stepTitle, marginBottom: 8 }}>How many rows does your greenhouse have?</h2>
          <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>
            Data is organised per row so you can compare conditions across your greenhouse.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 28 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const active = numRows === n
            return (
              <button
                key={n}
                onClick={() => setNumRows(n)}
                className="btn-press"
                style={{
                  height: 60, borderRadius: 9,
                  border: `1px solid ${active ? C.green : C.border}`,
                  background: active ? C.green : C.bg2,
                  color: active ? '#fff' : C.t1,
                  fontSize: 20, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.13s ease, color 0.13s ease, border-color 0.13s ease, box-shadow 0.13s ease',
                  boxShadow: active ? `0 2px 10px ${C.greenDim}` : 'none',
                }}
              >
                {n}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBack} className="btn-press" style={btnSecondary}>Back</button>
          <button onClick={onNext} className="btn-press" style={{ ...btnPrimary, flex: 1 }}>Continue</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Step 4 — Ready
───────────────────────────────────────────── */
function StepReady({ numRows, onFinish }) {
  return (
    <div className="step-in" style={stepWrap}>
      <div style={outerCard}>
        <Progress active={3} />

        {/* Check mark */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: C.greenDim, border: `1px solid ${C.green}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div style={{ marginBottom: 28 }}>
          <p style={stepLabel}>Ready</p>
          <h2 style={{ ...stepTitle, marginBottom: 10 }}>You're all set</h2>
          <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.65 }}>
            Monitoring{' '}
            <span style={{ fontWeight: 600, color: C.t1 }}>
              {numRows} {numRows === 1 ? 'row' : 'rows'}
            </span>
            . Upload images from the Classify page to start seeing data on your dashboard.
          </p>
        </div>

        <button onClick={onFinish} className="btn-press" style={{ ...btnPrimary, width: '100%', padding: '13px 20px', fontSize: 14 }}>
          View Dashboard
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Orchestrator
───────────────────────────────────────────── */
export default function Onboarding() {
  const navigate   = useNavigate()
  const [step, setStep]       = useState(1)
  const [numRows, setNumRows] = useState(5)

  const finish = () => {
    saveGreenhouseConfig({
      numRows,
      rows: Array.from({ length: numRows }, (_, i) => ({
        rowNumber: i + 1,
        length: 30,
        interval: 5,
      })),
    })
    navigate('/', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg0 }}>
      {step === 1 && <StepWelcome      onNext={() => setStep(2)} />}
      {step === 2 && <StepHowItWorks   onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepConfigure    numRows={numRows} setNumRows={setNumRows} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <StepReady        numRows={numRows} onFinish={finish} />}
    </div>
  )
}
