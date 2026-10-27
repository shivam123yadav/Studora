// @vitest-environment jsdom
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { db } from './lib/db'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let el: HTMLDivElement
let root: Root

/** Keep flushing React + IndexedDB + animation frames until `check` passes (or time out with the page text). */
async function until(check: () => boolean, ms = 5000) {
  const end = Date.now() + ms
  while (!check() && Date.now() < end) {
    await act(async () => void (await new Promise((r) => setTimeout(r, 50))))
  }
  if (!check()) throw new Error(`Timed out. Page text was: "${el.textContent}"`)
}

const hasText = (s: string) => () => !!el.textContent?.includes(s)
const byLabel = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
const click = (b: Element | null | undefined) => {
  if (!b) throw new Error('Tried to click something that is not on the page')
  return act(async () => void (b as HTMLButtonElement).click())
}

/** React tracks input values itself, so set via the native setter and fire a real input event. */
function typeInto(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function clickTab(label: string) {
  return click([...el.querySelectorAll('nav button')].find((b) => b.textContent?.includes(label)))
}

/** Add a task through the real UI: open the sheet, type a name, submit. */
async function addTaskViaUI(name: string) {
  await click([...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Add task' && !b.closest('[role=dialog]')))
  await until(() => !!el.querySelector('[role=dialog]'))
  await act(async () => typeInto(el.querySelector<HTMLInputElement>('[role=dialog] input[placeholder="e.g. Maths"]')!, name))
  await click([...el.querySelectorAll('[role=dialog] button')].find((b) => b.textContent?.trim() === 'Add task'))
  await until(() => !el.querySelector('[role=dialog]') && hasText(name)())
}

beforeEach(async () => {
  await db.tasks.clear()
  await db.sessions.clear()
  el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  el.remove()
  vi.restoreAllMocks()
})

describe('App', () => {
  // Regression: an effect must return undefined or a cleanup function, never a value.
  // Some browsers, extensions and scroll polyfills make window.scrollTo return something.
  it.each([
    ['returns nothing (standard browsers)', () => undefined],
    ['returns a Promise (some polyfills and extensions)', () => Promise.resolve()],
  ])('mounts, switches every tab and unmounts under StrictMode with no React errors when scrollTo %s', async (_name, scrollTo) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo

    await act(async () => root.render(<StrictMode><App /></StrictMode>))
    // Regression: Today used to render nothing at all when no timer was running
    await until(hasText('Add task'))

    await clickTab('Stats')
    await until(hasText('Total study time'))

    await clickTab('Settings')
    await until(hasText('Appearance'))

    await clickTab('Today')
    await until(hasText('Add task'))
    await act(async () => root.unmount())

    expect(errors.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([])
  })

  it('lets you add tasks, start one, switch to another, and pause', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.scrollTo = (() => undefined) as unknown as typeof window.scrollTo

    await act(async () => root.render(<StrictMode><App /></StrictMode>))
    await until(hasText('Add task'))

    await addTaskViaUI('Maths')
    await addTaskViaUI('Physics')
    expect(el.textContent).toContain('0m / 1h 00m') // default target is 1 hour

    // The coloured glow marks the running task's card, and only that card
    const card = (name: string) => (byLabel(`Start ${name}`) ?? byLabel(`Pause ${name}`))!.closest<HTMLElement>('.rounded-3xl')!
    const glowing = (name: string) => {
      const s = card(name).style.boxShadow
      return s !== '' && s !== 'none' && !s.includes('transparent')
    }

    await click(byLabel('Start Maths'))
    await until(() => !!byLabel('Pause Maths'))
    await until(() => glowing('Maths') && !glowing('Physics'))

    // Starting Physics pauses Maths automatically, and the glow moves with it
    await click(byLabel('Start Physics'))
    await until(() => !!byLabel('Pause Physics') && !!byLabel('Start Maths'))
    await until(() => glowing('Physics'))
    expect(card('Maths').style.boxShadow, 'Maths glow should clear once Maths is paused').toMatch(/^(none|.*transparent.*)$/)

    await click(byLabel('Pause Physics'))
    await until(() => !!byLabel('Start Physics') && !el.querySelector('button[aria-label^="Pause"]'))
    expect(card('Physics').style.boxShadow, 'Physics glow should clear after pausing').toMatch(/^(none|.*transparent.*)$/)

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(2)
    expect(sessions.every((s) => s.end !== null)).toBe(true)

    await act(async () => root.unmount())
    expect(errors.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([])
  }, 30_000)
})
