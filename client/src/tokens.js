/* ═══════════════════════════════════════════════
   GREENHOUSE GUARDIANS — DESIGN TOKENS
   Light mode, earthy/warm minimal palette
   Inspired by Profound Dashboard's design system
═══════════════════════════════════════════════ */
export const C = {
  // Backgrounds
  bg0: '#f9f7f4',      // page background — warm off-white
  bg1: '#ffffff',      // card surface
  bg2: '#f5f3ef',      // secondary card / section bg
  bg3: '#edeae4',      // input bg, hover, muted panels
  bg4: '#e4e0d8',      // selected state, active bg

  // Borders
  border:  '#e2ddd4',  // default card border
  border2: '#d4cfc5',  // stronger border

  // Text
  t1: '#1c1917',       // primary — warm stone-900
  t2: '#6b6560',       // secondary — warm gray
  t3: '#a09890',       // tertiary / muted

  // Brand green — earthy forest tones
  green:    '#3d6b4f',
  greenDim: 'rgba(61,107,79,0.10)',
  greenMid: '#4a7c59',

  // Semantic — tomatoes
  ripe:        '#3d6b4f',               // forest green
  ripeDim:     'rgba(61,107,79,0.12)',
  halfRipe:    '#a06b1a',               // warm amber
  halfRipeDim: 'rgba(160,107,26,0.12)',
  unripe:      '#b84040',               // muted red
  unripeDim:   'rgba(184,64,64,0.12)',

  // Semantic — flowers
  flower0:    '#4f7aa8',               // slate blue — bud
  flower0Dim: 'rgba(79,122,168,0.12)',
  flower1:    '#7c5cbf',               // muted violet — anthesis
  flower1Dim: 'rgba(124,92,191,0.12)',
  flower2:    '#b86a2f',               // burnt sienna — post-anthesis
  flower2Dim: 'rgba(184,106,47,0.12)',

  // Utility
  amber:    '#a06b1a',
  amberDim: 'rgba(160,107,26,0.10)',
  red:      '#b84040',
  redDim:   'rgba(184,64,64,0.10)',
}

// Tomato + flower color maps (for charts, dots, badges)
export const TOMATO_COLORS = {
  Ripe:      C.ripe,
  Half_Ripe: C.halfRipe,
  Unripe:    C.unripe,
}

export const FLOWER_COLORS = {
  '0': C.flower0,
  '1': C.flower1,
  '2': C.flower2,
}

export const FLOWER_LABELS = {
  '0': 'Bud',
  '1': 'Anthesis',
  '2': 'Post-Anthesis',
}
