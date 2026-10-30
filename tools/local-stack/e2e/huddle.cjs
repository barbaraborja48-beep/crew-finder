// Buddy huddle on a stage close-up: Barbara, Lara and Mar buddied up, Pau alone nearby.
const { sql, phone, join, refresh, shot, check, done, APP } = require('./lib.cjs')
const IPHONE = { width: 402, height: 874 }
const T = '2026-10-31T21:10:00+01:00'
const TAG = process.env.TAG || 'after'
const tab = (p, name) => p.locator('nav.tabbar button', { hasText: name }).click()
const buddy = async (from, to, name) => {
  await refresh(from); await tab(from, 'Crew')
  await from.getByRole('button', { name: new RegExp('^' + name) }).first().click()
  await from.getByRole('button', { name: 'Buddy up' }).click()
  await from.getByRole('button', { name: 'Close' }).first().click()
  await refresh(to); await tab(to, 'Crew')
  await to.getByRole('button', { name: 'Buddy up', exact: true }).click()
  await to.waitForTimeout(1200)
}
;(async () => {
  const B = await phone('Barbara', T, { viewport: IPHONE })
  await B.goto(APP)
  await B.getByRole('button', { name: 'Start a crew' }).click().catch(() => {})
  await B.getByPlaceholder('Crew name, e.g. Saturday squad').fill('Bruja squad')
  await B.getByRole('button', { name: 'Create crew' }).click()
  await B.getByPlaceholder('What your crew calls you').fill('Barbara')
  await B.getByRole('button', { name: 'Join crew' }).click()
  await B.locator('nav.tabbar').waitFor()
  const L = await phone('Lara', T, { viewport: IPHONE })
  const M = await phone('Mar', T, { viewport: IPHONE })
  const P = await phone('Pau', T, { viewport: IPHONE })
  for (const [p, n] of [[L, 'Lara'], [M, 'Mar'], [P, 'Pau']]) await join(p, 'bruja-squad', n)
  await sql(`update members set color = case name when 'Barbara' then '#d23bff' when 'Lara' then '#b6ff3b' when 'Mar' then '#ffc83b' else '#4cc3ff' end, acc = case name when 'Barbara' then 11 when 'Lara' then 10 when 'Mar' then 15 else 1 end`)
  await buddy(B, L, 'Lara')
  await buddy(B, M, 'Mar')
  // Pau pins first, then Barbara pins for the group a little to the left
  for (const [p, x, y] of [[P, 270, 560], [B, 150, 560]]) {
    await refresh(p); await tab(p, 'Pin')
    await p.getByRole('button', { name: /^elrow/ }).first().click()
    await p.mouse.click(x, y)
    await p.waitForTimeout(1200)
  }
  for (const [p, n] of [[B, 'barbara'], [L, 'lara']]) {
    await refresh(p); await tab(p, 'Pin')
    await p.getByRole('button', { name: /^elrow/ }).first().click()
    await shot(p, `h-${TAG}-${n}`, { wait: 1200 })
  }
  const label = await B.getByText('You, Lara, Mar').or(B.getByText('Lara, You, Mar')).or(B.getByText(/You.*Lara.*Mar|Lara.*Mar.*You|Mar.*You|Lara.*You/)).count()
  if (TAG === 'after') check(label > 0, 'one name line under the huddle')
  await done()
})().catch(e => { console.error(e); process.exit(1) })
