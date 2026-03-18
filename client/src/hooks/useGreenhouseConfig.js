const GG_CONFIG_KEY = 'gg_config'

/**
 * Read the greenhouse config from localStorage (sync, no React state).
 * Safe to call outside of components.
 */
export function getGreenhouseConfig() {
  try {
    const raw = localStorage.getItem(GG_CONFIG_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Write (or clear) the greenhouse config.
 */
export function saveGreenhouseConfig(cfg) {
  if (cfg == null) {
    localStorage.removeItem(GG_CONFIG_KEY)
  } else {
    localStorage.setItem(GG_CONFIG_KEY, JSON.stringify(cfg))
  }
}

/**
 * Return the configured row numbers as an array, e.g. [1,2,3,4,5].
 * Falls back to [1..10] if no config is stored.
 */
export function getConfiguredRows() {
  const cfg = getGreenhouseConfig()
  const n = cfg?.numRows ?? 5
  return Array.from({ length: n }, (_, i) => i + 1)
}

/**
 * Return the configured row objects, each with { rowNumber, length, interval }.
 */
export function getRowConfigs() {
  const cfg = getGreenhouseConfig()
  return cfg?.rows ?? []
}
