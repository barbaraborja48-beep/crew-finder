// Hallowfest at Fabrik: festival map like Halloween Takeover, six stages with DJ screens and logos,
// the haunted house, and doors with "Arriving / leaving".
const { sql, phone, join, startCrew, refresh, shot, check, done } = require('./lib.cjs')
const T = '2026-11-01T03:00:00+01:00' // Charlotte de Witte on the Main Room
const V = { viewport: { width: 402, height: 874 } }
const crew = async () => (await sql('select id from crews order by created_at desc limit 1'))[0].id
const lastPin = async name => (await sql('select c.place_id, c.nx, c.ny from checkins c join members m on m.id = c.member_id where m.name = $1 and m.crew_id = $2 order by c.born desc limit 1', [name, await crew()]))[0]
const skip = p => p.getByRole('dialog', { name: 'Welcome to PinGü' }).getByRole('button', { name: 'Skip' }).click().catch(() => {})
;(async () => {
  const B = await phone('Barbara', T, V)
  await B.goto(require('./lib.cjs').APP)
  await shot(B, 'f0-welcome')
  const code = await startCrew(B, 'hallowfest' + (Date.now() % 100000), 'Hallowfest')
  await B.getByPlaceholder('What your crew calls you').fill('Barbara')
  await B.getByRole('button', { name: 'Join crew' }).click()
  await B.locator('nav.tabbar').waitFor()
  await skip(B)
  const L = await phone('Lara', T, V)
  await join(L, code, 'Lara')
  await skip(L)
  const M = await phone('Mar', T, V)
  await join(M, code, 'Mar')
  await skip(M)
  check((await sql('select v.event_name from crews c join venues v on v.id = c.venue_id where c.id = $1', [await crew()]))[0].event_name === 'Hallowfest', 'crew is at Hallowfest')
  await shot(B, 'f1-map', { wait: 1000 })
  check(await B.getByText('▶ Charlotte de Witte').isVisible(), 'the map shows who is on at the Main Room')

  // Barbara: Main Room close-up, DJ screen, pin
  await B.getByRole('button', { name: 'Main Room', exact: true }).click()
  await B.waitForTimeout(800)
  check(await B.getByText('Charlotte de Witte', { exact: true }).first().isVisible(), 'Main Room DJ screen: Charlotte de Witte at 03:00')
  const floor = await B.locator('[style*="cursor: crosshair"]').first().boundingBox()
  await B.mouse.click(floor.x + floor.width / 2, floor.y + floor.height * 0.2)
  await B.waitForTimeout(1500)
  check((await lastPin('Barbara'))?.place_id === 'f-main', 'Barbara pinned at the Main Room')
  await shot(B, 'f2-main-room', { wait: 600 })
  await B.locator('button.dj').click()
  await shot(B, 'f3-lineup', { wait: 1000 })
  await B.getByRole('button', { name: 'Close' }).click()

  // Lara: Crystal 360º, the longest names
  await L.getByRole('button', { name: 'Crystal 360º', exact: true }).click()
  await L.waitForTimeout(800)
  await L.clock.setFixedTime(new Date('2026-11-01T04:00:00+01:00'))
  await L.waitForTimeout(1200)
  check(await L.getByText('Raúl Ortiz vs Chimo Bayo vs Paco Pil').first().isVisible(), 'Crystal DJ screen at 04:00')
  const fl = await L.locator('[style*="cursor: crosshair"]').first().boundingBox()
  await L.mouse.click(fl.x + fl.width * 0.8, fl.y + fl.height * 0.8)
  await L.waitForTimeout(1500)
  check((await lastPin('Lara'))?.place_id === 'f-crystal', 'Lara pinned at Crystal 360º')
  await shot(L, 'f4-crystal', { wait: 600 })

  // Mar: the haunted house, then the door: leaving in 15 min
  await M.getByRole('button', { name: 'Gran Pasaje del Terror' }).click()
  await M.getByRole('button', { name: 'Pin me here' }).click()
  await M.waitForTimeout(1500)
  check((await lastPin('Mar'))?.place_id === 'f-terror', 'Mar pinned at the Gran Pasaje del Terror')
  await M.getByRole('button', { name: 'Puerta Hangar' }).click()
  await shot(M, 'f5-door-card', { wait: 500 })
  await M.getByRole('button', { name: 'Arriving / leaving' }).click()
  await M.getByRole('button', { name: 'Leaving', exact: true }).click()
  await M.getByRole('button', { name: '15 min', exact: true }).click()
  await M.getByRole('button', { name: 'Tell the crew' }).click()
  await M.waitForTimeout(2500)

  // Barbara sees everyone, with stage logos on the profile circles
  await refresh(B)
  await B.locator('nav.tabbar button', { hasText: 'Map' }).click()
  await B.waitForTimeout(1200)
  check(await B.locator('img[src*="fabrik-resistencia"]').count() > 0, 'Lara\'s circle wears the La Resistencia logo')
  await shot(B, 'f6-barbara-map', { wait: 600 })
  await B.locator('nav.tabbar button', { hasText: 'Chat' }).click()
  await B.waitForTimeout(800)
  check(await B.getByText(/is leaving in 15 minutes/).first().isVisible(), 'Barbara sees "Mar is leaving in 15 minutes"')
  await shot(B, 'f7-chat', { wait: 300 })
  await done()
})().catch(e => { console.error(e); process.exit(1) })
