/**
 * Task colours: 8 categorical slots, each with a light-mode and a dark-mode value.
 * The set is checked with the dataviz palette validator (lightness band, colour-blind
 * separation, contrast) in both modes. The light hex is what's stored on the task;
 * `taskColor` resolves it for the current theme.
 */
const SLOTS = [
  { light: '#2a78d6', dark: '#3987e5' }, // blue
  { light: '#eb6834', dark: '#d95926' }, // orange
  { light: '#1baf7a', dark: '#199e70' }, // aqua
  { light: '#eda100', dark: '#c98500' }, // yellow
  { light: '#e87ba4', dark: '#d55181' }, // magenta
  { light: '#008300', dark: '#008300' }, // green
  { light: '#6250d6', dark: '#9085e9' }, // violet
  { light: '#e34948', dark: '#e66767' }, // red
]

export const TASK_COLORS = SLOTS.map((s) => s.light)

const darkOf = new Map(SLOTS.map((s) => [s.light, s.dark]))

function isDark() {
  return document.documentElement.classList.contains('dark')
}

/** The colour to paint a task's marks with in the current theme. */
export function taskColor(stored: string): string {
  return isDark() ? (darkOf.get(stored) ?? stored) : stored
}

/** Icon/label colour for text sitting on a task-coloured fill. */
export function inkOn(stored: string): string {
  return stored === '#eda100' ? '#0b0b0b' : '#ffffff'
}
