// Mondo Krystal at Terraza Jowke: tap-anywhere map, closed rooms, the door (arriving / leaving),
// and the open-air floor close-up with rings around the DJ.
const { sql, phone, join, startCrew, refresh, shot, check, done } = require('./lib.cjs')
const T = '2026-10-31T16:30:00+01:00'
const V = { viewport: { width: 402, height: 874 } }
const youAt = async p => (await p.getByText('You', { exact: true }).first().boundingBox())
const lastPin = async name => (await sql(`select p.name, p.near, c.nx, c.ny, c.place_id from checkins c join members m on m.id = c.member_id join places p on p.id = c.place_id and p.venue_id = (select venue_id from crews where id = m.crew_id) where m.name = $1 and m.crew_id = (select id from crews order by created_at desc limit 1) order by c.born desc limit 1`, [name]))[0]
;(async () => {
  const B = await phone('Barbara', T, V)
  await B.goto(require('./lib.cjs').APP)
  await B.getByRole('button', { name: 'Start a crew' }).click().catch(() => {})
  await shot(B, 'j0-welcome')
  const code = await startCrew(B, 'jowke' + (Date.now() % 100000), 'Mondo Krystal')
  await B.getByPlaceholder('What your crew calls you').fill('Barbara')
  await B.getByRole('button', { name: 'Join crew' }).click()
  await B.locator('nav.tabbar').waitFor()
  await B.getByRole('dialog', { name: 'Welcome to PinGü' }).getByRole('button', { name: 'Skip' }).click().catch(() => {})
  const L = await phone('Lara', T, V)
  await join(L, code, 'Lara')
  const M = await phone('Mar', T, V)
  await join(M, code, 'Mar')
  for (const p of [L, M]) await p.getByRole('dialog', { name: 'Welcome to PinGü' }).getByRole('button', { name: 'Skip' }).click().catch(() => {})
  // Phones subscribed to notifications (the fake push service records what each would get).
  const crypto = require('crypto')
  for (const r of await sql('select id, name from members where crew_id = (select id from crews order by created_at desc limit 1)')) {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.generateKeys()
    await sql('insert into push_subscriptions (endpoint, member_id, crew_id, p256dh, auth) select $1, id, crew_id, $2, $3 from members where id = $4', [
      `https://127.0.0.1:54322/fakepush/${r.name}`, ecdh.getPublicKey('base64url'), crypto.randomBytes(16).toString('base64url'), r.id,
    ])
  }
  await shot(B, 'j1-map-empty', { wait: 800 })

  const frame = p => p.locator('[style*="touch-action: none"]').first().boundingBox()
  // Barbara taps the dance floor, Lara the long bar along the wall
  let fr = await frame(B)
  const tap = { x: fr.x + 200, y: fr.y + 230 }
  await B.mouse.click(tap.x, tap.y)
  await B.waitForTimeout(1500)
  const you = await youAt(B)
  check(you && Math.abs(you.x + you.width / 2 - tap.x) < 8 && Math.abs(you.y - tap.y) < 22, 'tap pins right under the finger')
  let pin = await lastPin('Barbara')
  console.log('   Barbara:', pin && pin.name)
  check(pin && pin.place_id === 'j-pista', 'a tap on the dance floor pins "Dance floor"')
  fr = await frame(L)
  await L.mouse.click(fr.x + 360, fr.y + 60) // the empty space beside the building
  await L.waitForTimeout(800)
  check(!(await lastPin('Lara')) && (await L.locator('text=Tap inside the venue').count()) > 0, 'a tap off the venue doesn\'t pin, it says "Tap inside the venue"')
  const u = (fr.width / 390) * 0.5462 // screen px per map image px
  await L.mouse.click(fr.x + 520 * u, fr.y + 340 * u) // on the long bar, beside its icon
  await L.waitForTimeout(1500)
  pin = await lastPin('Lara')
  check(pin && pin.place_id === 'j-bar1', `a tap on the long bar pins "Bar · dance floor" (got ${pin && pin.place_id})`)

  // Mar heads inside via the Pin tab tile
  await M.locator('nav.tabbar button', { hasText: 'Pin' }).click()
  await M.waitForTimeout(600)
  await shot(M, 'j2-pin-page', { wait: 600 })
  await M.getByRole('button', { name: 'Inside / rest area' }).click()
  await M.waitForTimeout(1500)
  pin = await lastPin('Mar')
  check(pin && pin.place_id === 'j-dentro', 'the "Inside / rest area" tile pins inside')

  // Barbara's Pin page: tap just under the DJ booth = front front
  await B.locator('nav.tabbar button', { hasText: 'Pin' }).click()
  await B.waitForTimeout(1500)
  const floor = B.locator('[style*="cursor: crosshair"]').first()
  const fb = await floor.boundingBox()
  const k = fb.width / 654 // close-up px per map px
  const CUT = 310 // the close-up starts below the DJ booth
  await B.mouse.click(fb.x + (258 - 60) * k, fb.y + (240 + 135 - CUT) * k)
  await B.waitForTimeout(1500)
  const line = await B.getByText(/^Dance floor · /).first().textContent()
  console.log('   footer:', line)
  check(/front front (middle|left)/.test(line), 'just under the DJ is "front front"')
  check(await B.getByText('front front', { exact: true }).count() === 0, 'no row labels on the floor')
  await B.mouse.click(fb.x + (183 - 60) * k, fb.y + (430 - CUT) * k)
  await B.waitForTimeout(1500)
  check((await B.getByText(/^Dance floor · /).first().textContent()) === 'Dance floor · front left · by bar', 'by the small bar: "front left · by bar"')
  await B.mouse.click(fb.x + (183 - 60) * k, fb.y + (520 - CUT) * k)
  await B.waitForTimeout(1500)
  check((await B.getByText(/^Dance floor · /).first().textContent()) === 'Dance floor · center left · by bar', 'below it: "center left · by bar"')
  await B.mouse.click(fb.x + (258 - 60 + 400 * Math.cos(1.2)) * k, fb.y + (240 + 400 * Math.sin(1.2) - CUT) * k)
  await B.waitForTimeout(1500)
  const line2 = await B.getByText(/^Dance floor · /).first().textContent()
  console.log('   footer:', line2)
  check(/back middle/.test(line2), 'further back in the middle is "back middle"')
  await B.getByRole('button', { name: 'WC / water' }).click()
  await B.waitForTimeout(1500)
  check((await lastPin('Barbara'))?.place_id === 'j-wc2', 'the "WC / water" button pins at the WC / water')
  await shot(B, 'j3-pin-floor', { wait: 800 })

  // Map: slide down to the inside, entrance and the closed rooms
  await B.locator('nav.tabbar button', { hasText: 'Map' }).click()
  await B.waitForTimeout(800)
  await shot(B, 'j4-map-top', { wait: 600 })
  fr = await frame(B)
  const slide = async dy => {
    await B.mouse.move(fr.x + 200, fr.y + fr.height - 20); await B.mouse.down()
    await B.mouse.move(fr.x + 200, fr.y + fr.height - 20 - dy, { steps: 12 }); await B.mouse.up()
    await B.waitForTimeout(600)
  }
  await slide(300)
  await shot(B, 'j5-map-middle', { wait: 400 })
  check(await B.getByRole('button', { name: 'Arriving / leaving' }).isVisible(), 'the entrance shows "Arriving / leaving"')
  await slide(330)
  await shot(B, 'j5-map-slid', { wait: 400 })
  // tap the closed rooms
  const closedLabel = B.getByText('closed off', { exact: true })
  const cb = await closedLabel.boundingBox().catch(() => null)
  if (cb) {
    await B.mouse.click(cb.x + cb.width / 2, cb.y + 30)
    await B.waitForTimeout(400)
    check(await B.getByText('That part is closed off tonight').isVisible().catch(() => false), 'a tap on the closed rooms says it\'s closed, no pin')
    await shot(B, 'j6-closed', { wait: 200 })
  } else check(false, 'closed rooms visible after sliding')
  check((await lastPin('Barbara')).place_id === 'j-wc2', 'still pinned at the WC / water after tapping the closed part')

  // the door: arriving / leaving
  await B.getByRole('button', { name: 'Arriving / leaving' }).dispatchEvent('click')
  await B.waitForTimeout(500)
  await B.getByRole('button', { name: 'Arriving', exact: true }).click()
  await B.getByRole('button', { name: '10 min', exact: true }).click()
  await shot(B, 'j7-eta-sheet', { wait: 300 })
  const before = (await (await fetch('http://localhost:54321/_test/pushes')).json()).length
  await B.getByRole('button', { name: 'Tell the crew' }).click()
  await B.waitForTimeout(5000)
  const sent = (await (await fetch('http://localhost:54321/_test/pushes')).json()).slice(before)
  console.log('   notifications:', JSON.stringify(sent.map(p => `${p.to}:${(p.topic ?? '').slice(0, 7)}`)))
  check(sent.some(p => p.to === 'Lara') && sent.some(p => p.to === 'Mar') && !sent.some(p => p.to === 'Barbara'), 'Lara and Mar get a notification, Barbara doesn\'t')
  await refresh(L)
  await L.locator('nav.tabbar button', { hasText: 'Chat' }).click()
  await L.waitForTimeout(2500)
  check(await L.getByText(/is arriving in 10 minutes/).first().isVisible().catch(() => false), 'Lara sees "Barbara is arriving in 10 minutes" in chat')
  await shot(L, 'j8-chat', { wait: 300 })
  await L.locator('nav.tabbar button', { hasText: 'Map' }).click()
  await L.waitForTimeout(1200)
  await shot(L, 'j9-lara-map', { wait: 600 })

  // The lineups at set time: Jeff Mills at Jowke (20:30), the afterparty at Sala But (00:30).
  await B.clock.setFixedTime(new Date('2026-10-31T20:30:00+01:00'))
  await B.locator('nav.tabbar button', { hasText: 'Pin' }).click()
  await B.waitForTimeout(1200)
  check(await B.getByText('Jeff Mills', { exact: true }).first().isVisible(), 'Jowke DJ screen: Jeff Mills at 20:30')
  await shot(B, 'j10-jeff-mills', { wait: 400 })
  await B.locator('button.dj').click()
  await shot(B, 'j11-jowke-lineup', { wait: 1000 })
  const A = await phone('After', '2026-11-01T00:30:00+01:00', V)
  await startCrew(A, 'afterparty' + (Date.now() % 100000), 'Mondo Disko')
  await A.getByPlaceholder('What your crew calls you').fill('Barbara')
  await A.getByRole('button', { name: 'Join crew' }).click()
  await A.locator('nav.tabbar').waitFor()
  await A.getByRole('dialog', { name: 'Welcome to PinGü' }).getByRole('button', { name: 'Skip' }).click().catch(() => {})
  await A.locator('nav.tabbar button', { hasText: 'Pin' }).click()
  await A.waitForTimeout(1200)
  check(await A.getByText('DJ Swisherman', { exact: true }).first().isVisible(), 'Sala But DJ screen: the afterparty at 00:30')
  await shot(A, 'j12-sala-but-afterparty', { wait: 400 })
  await done()
})().catch(e => { console.error(e); process.exit(1) })
