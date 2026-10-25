// Shared helpers for the local PinGü runs: phones, the database, screenshots.
const { chromium } = require('playwright')
const { Client } = require('/opt/shim/node_modules/pg')
const fs = require('fs')

const APP = process.env.APP || 'http://localhost:4173'
const SHOTS = process.env.SHOTS || '/opt/e2e/shots'
fs.mkdirSync(SHOTS, { recursive: true })

async function sql(q, args = []) {
  const c = new Client({ host: '/opt/pg', port: 54329, user: 'postgres', database: 'pingu' })
  await c.connect()
  try {
    return (await c.query(q, args)).rows
  } finally {
    await c.end()
  }
}

let browser
async function phone(name, time, opts = {}) {
  browser ??= await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  if (time) await ctx.clock.install({ time: new Date(time) })
  if (opts.lowData) await ctx.addInitScript(() => localStorage.setItem('pingu-low-data', '1'))
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log(`[${name}] page error:`, e.message))
  page.on('console', m => m.type() === 'error' && !/WebSocket|realtime|ERR_CONNECTION|Failed to load resource/.test(m.text()) && console.log(`[${name}] console:`, m.text()))
  page.name = name
  return page
}

async function join(page, code, name) {
  await page.goto(`${APP}/?crew=${code}`)
  await page.getByPlaceholder('What your crew calls you').fill(name)
  await page.getByRole('button', { name: 'Join crew' }).click()
  await page.locator('nav.tabbar button', { hasText: 'Map' }).waitFor({ timeout: 15000 })
}

async function startCrew(page, crewName, venueLabel) {
  await page.goto(APP)
  await page.getByRole('button', { name: 'Start a crew' }).click().catch(() => {})
  if (venueLabel) await page.getByRole('radio', { name: new RegExp(venueLabel) }).click().catch(async () => page.getByText(venueLabel, { exact: false }).first().click())
  await page.getByPlaceholder('Crew name, e.g. Saturday squad').fill(crewName)
  await page.getByRole('button', { name: 'Create crew' }).click()
  await page.getByPlaceholder('What your crew calls you').waitFor()
  const code = new URL(page.url()).searchParams.get('crew') ?? (await sql('select invite_code from crews order by created_at desc limit 1'))[0].invite_code
  return code
}

/** Fresh data from the server (what the phone gets when it reopens the app). */
async function refresh(page) {
  await page.reload()
  await page.locator('nav.tabbar button', { hasText: 'Map' }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200)
}

async function shot(page, file, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 500)
  await page.screenshot({ path: `${SHOTS}/${file}.png`, ...opts })
  console.log('📸', file)
}

let fails = 0
function check(ok, what) {
  console.log(ok ? '✅' : '❌', what)
  if (!ok) fails++
}
const done = async () => {
  await browser?.close()
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
  process.exit(fails ? 1 : 0)
}

module.exports = { APP, sql, phone, join, startCrew, refresh, shot, check, done }
