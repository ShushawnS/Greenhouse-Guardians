import { useSettings } from '../context/SettingsContext'
import { useNavigate } from 'react-router-dom'
import { C } from '../tokens'
import { saveGreenhouseConfig } from '../hooks/useGreenhouseConfig'

/* ── Track selector (Remote / Local) ── */
function TrackSelector({ value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 3,
      gap: 2,
    }}>
      {['remote', 'local'].map(track => {
        const active = value === track
        return (
          <button
            key={track}
            onClick={() => onChange(track)}
            style={{
              padding: '5px 16px',
              borderRadius: 6,
              border: 'none',
              background: active ? C.green : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              color: active ? '#fff' : C.t3,
              fontWeight: active ? 500 : 400,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
              textTransform: 'capitalize',
            }}
          >
            {track}
          </button>
        )
      })}
    </div>
  )
}

/* ── Toggle switch ── */
function Toggle({ value, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? C.green : C.bg3,
        border: `1.5px solid ${value ? C.green : C.border2}`,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2, left: 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transform: value ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 0.2s ease',
        willChange: 'transform',
      }} />
    </button>
  )
}

/* ── Section card ── */
function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: C.bg1,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${C.border}`,
        background: C.bg2,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  )
}

/* ── Setting row ── */
function SettingRow({ label, description, control }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: 24,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5 }}>{description}</div>
      </div>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>{control}</div>
    </div>
  )
}

export default function Settings() {
  const { settings, updateSettings, resetSettings, DEFAULTS } = useSettings()
  const navigate = useNavigate()

  const isDirty =
    settings.confidenceThreshold !== DEFAULTS.confidenceThreshold ||
    settings.autoRefresh !== DEFAULTS.autoRefresh ||
    settings.tomatoTrack !== DEFAULTS.tomatoTrack ||
    settings.flowerTrack !== DEFAULTS.flowerTrack

  return (
    <div
      className="page-in page-pad"
      style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: '-0.3px', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Configure classification and display preferences</p>
      </div>

      {/* ML Model */}
      <Section
        title="ML Model"
        subtitle="Controls how the YOLOv8 classifiers score detections"
      >
        <SettingRow
          label="Confidence Threshold"
          description="Only detections at or above this confidence score are included in results. Lower values catch more detections but may add false positives."
          control={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 160 }}>
              {/* Value badge */}
              <div style={{
                fontSize: 20, fontWeight: 700, color: C.green,
                letterSpacing: '-0.5px', lineHeight: 1,
              }} className="num">
                {(settings.confidenceThreshold * 100).toFixed(0)}%
              </div>
              {/* Slider */}
              <input
                type="range"
                min={0.10}
                max={1.00}
                step={0.01}
                value={settings.confidenceThreshold}
                onChange={e => updateSettings({ confidenceThreshold: parseFloat(e.target.value) })}
                style={{ width: 160, accentColor: C.green, cursor: 'pointer' }}
              />
              {/* Range labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: 160 }}>
                <span style={{ fontSize: 10, color: C.t3 }}>10%</span>
                <span style={{ fontSize: 10, color: C.t3 }}>100%</span>
              </div>
            </div>
          }
        />

        {/* Preset chips */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: C.t3 }}>Presets:</span>
          {[
            { label: 'Low (25%)',    value: 0.25 },
            { label: 'Medium (50%)', value: 0.50 },
            { label: 'High (75%)',   value: 0.75 },
          ].map(({ label, value }) => {
            const active = Math.abs(settings.confidenceThreshold - value) < 0.005
            return (
              <button
                key={value}
                onClick={() => updateSettings({ confidenceThreshold: value })}
                style={{
                  padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${active ? C.green : C.border}`,
                  background: active ? C.greenDim : C.bg2,
                  color: active ? C.green : C.t2,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, margin: '20px 0' }} />

        {[
          {
            key: 'tomatoTrack',
            label: 'Tomato Model Track',
            description: 'Remote uses the hosted HF Space inference API. Local runs the YOLOv8 model directly on this server.',
          },
          {
            key: 'flowerTrack',
            label: 'Flower Model Track',
            description: 'Remote uses the hosted HF Space inference API. Local runs the YOLOv8 model directly on this server.',
          },
        ].map(({ key, label, description }) => (
          <div key={key} style={{ marginTop: key === 'tomatoTrack' ? 0 : 16 }}>
            <SettingRow
              label={label}
              description={description}
              control={
                <TrackSelector
                  value={settings[key]}
                  onChange={val => updateSettings({ [key]: val })}
                />
              }
            />
          </div>
        ))}
      </Section>

      {/* Display */}
      <Section
        title="Display"
        subtitle="Controls how data is presented in the app"
      >
        <SettingRow
          label="Auto-refresh Timeline"
          description="Automatically poll for new classification events every 20 seconds on the Timeline page. A banner appears when new entries are detected."
          control={
            <Toggle
              value={settings.autoRefresh}
              onChange={val => updateSettings({ autoRefresh: val })}
            />
          }
        />
      </Section>

      {/* Demo */}
      <Section
        title="Demo"
        subtitle="Onboarding and greenhouse configuration"
      >
        <SettingRow
          label="Replay intro"
          description="Restart the onboarding flow to reconfigure your greenhouse rows or revisit the how-it-works walkthrough."
          control={
            <button
              onClick={() => { saveGreenhouseConfig(null); navigate('/onboarding') }}
              style={{
                padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: `1px solid ${C.border2}`,
                background: C.bg2, color: C.t2,
                cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
              }}
            >
              ↺ Replay intro
            </button>
          }
        />
      </Section>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: C.t3 }}>
          {isDirty ? 'Changes saved automatically' : 'Using default settings'}
        </span>
        <button
          onClick={resetSettings}
          disabled={!isDirty}
          style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            border: `1px solid ${isDirty ? C.border2 : C.border}`,
            background: C.bg2, color: isDirty ? C.t2 : C.t3,
            cursor: isDirty ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
          }}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
