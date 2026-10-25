// Halloween night on three phones: buddies, set plans, planned moves, mutes, notifications.
const crypto = require('crypto')
const { sql, phone, join, startCrew, refresh, shot, check, done } = require('./lib.cjs')

const T = '2026-10-31T20:40:00+01:00' // Kölsch is on at Brunch!, What So Not at La Plaza

;(async () => {
  const B = await phone('Barbara', T)
  const L = await phone('Lara', T)
  const M = await phone('Mar', T)

  const code = await startCrew(B, 'Halloween squad', 'Halloween')
  await B.getByPlaceholder('What your crew calls you').fill('Barbara')
  await B.getByRole('button', { name: 'Join crew' }).click()
  await B.locator('nav.tabbar').waitFor()
  await join(L, code, 'Lara')
  await join(M, code, 'Mar')
  const ids = Object.fromEntries((await sql('select name, id from members')).map(r => [r.name, r.id]))
  // Different colors and accessories, like a real crew.
  await sql(`update members set color = case name when 'Barbara' then '#ff3bd4' when 'Lara' then '#b6ff3b' else '#ffc83b' end, acc = case name when 'Barbara' then 6 when 'Lara' then 1 else 4 end`)

  // Phones subscribed to notifications (fake push service records what each would get).
  for (const [n, id] of Object.entries(ids)) {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.generateKeys()
    await sql('insert into push_subscriptions (endpoint, member_id, crew_id, p256dh, auth) select $1, id, crew_id, $2, $3 from members where id = $4', [
      `https://127.0.0.1:54322/fakepush/${n}`, ecdh.getPublicKey('base64url'), crypto.randomBytes(16).toString('base64url'), id,
    ])
  }

  // ── everyone pins at Brunch! ──
  for (const [p, x] of [[B, 195], [L, 120], [M, 270]]) {
    await refresh(p)
    await p.getByRole('button', { name: 'Pin', exact: true }).click()
    await p.getByRole('button', { name: /^Brunch!/ }).first().click().catch(() => {})
    await p.mouse.click(x, 600)
    await p.waitForTimeout(800)
  }

  // ── buddy up: Barbara asks Lara and Mar ──
  for (const who of ['Lara', 'Mar']) {
    await B.locator('nav.tabbar button', { hasText: 'Crew' }).click()
    await B.getByRole('button', { name: new RegExp(`^${who}`) }).first().click()
    await B.getByRole('button', { name: 'Buddy up' }).click()
    await B.getByRole('button', { name: 'Close' }).click()
  }
  await refresh(L)
  await L.locator('nav.tabbar button', { hasText: 'Crew' }).click()
  check(await L.getByText('Barbara wants to buddy up').isVisible(), 'Lara sees the buddy request')
  await shot(L, '01-lara-buddy-request')
  await L.getByRole('button', { name: 'Buddy up', exact: true }).click()
  await refresh(M)
  await M.locator('nav.tabbar button', { hasText: 'Crew' }).click()
  await M.getByRole('button', { name: 'Buddy up', exact: true }).click()
  await M.waitForTimeout(1500)
  const groups = await sql('select count(distinct buddy) n, count(*) c from members where buddy is not null')
  check(groups[0].n == 1 && groups[0].c == 3, 'all three in one buddy group')

  // ── Lara moves the group to the bar: everyone's penguin moves ──
  await refresh(L)
  await L.getByRole('button', { name: 'Pin', exact: true }).click()
  await L.getByRole('button', { name: 'Bars' }).click()
  await L.mouse.click(250, 280)
  await shot(L, '02-lara-pins-group-toast', { wait: 300 })
  await L.waitForTimeout(1500)
  await refresh(B)
  await B.locator('nav.tabbar button', { hasText: 'Map' }).click()
  await shot(B, '03-barbara-map-group-at-bar')
  const crewTxt = await B.locator('.screen').first().innerText()
  check((crewTxt.match(/Bar · by Brunch/g) ?? []).length === 2, 'Barbara sees Lara and Mar at the bar (Mar never pinned there)')

  // ── Barbara: lineup at Brunch!, stars Kölsch and What So Not (a clash) ──
  await B.getByRole('button', { name: 'Pin', exact: true }).click()
  await B.getByRole('button', { name: 'Stages' }).click().catch(() => {})
  await B.getByRole('button', { name: /^Brunch!/ }).first().click()
  await B.locator('button.dj').click()
  await B.getByRole('button', { name: 'Add Maceo Plex to my night' }).click()
  await B.getByRole('button', { name: 'Add Kölsch to my night' }).click()
  await B.locator('.dj-remind').first().click()
  await shot(B, '04-lineup-stars-reminders')
  await B.locator('.dj-remind-opts button', { hasText: '15 min' }).click()
  await B.locator('.dj-tabs button', { hasText: 'La Plaza' }).click()
  await B.getByRole('button', { name: 'Add What So Not to my night' }).click()
  await B.locator('.dj-tabs button', { hasText: 'My night' }).click()
  await B.getByRole('switch', { name: 'Share my plan' }).click()
  await shot(B, '05-my-night-clash')
  await B.locator('.dj-clash select').selectOption({ label: '21.00H' })
  await B.waitForTimeout(400)
  await shot(B, '06-my-night-switch-21')
  await B.getByRole('button', { name: 'Close' }).click()
  await B.waitForTimeout(1500)
  const rem = await sql(`select title, to_char(due_at at time zone 'Europe/Madrid', 'HH24:MI') due from reminders where kind = 'set' order by due_at`)
  console.log('   set reminders:', JSON.stringify(rem))
  check(rem.length === 3 && rem.some(r => /Switch to/.test(r.title)), 'reminders saved for upcoming picks, with the switch time')
  await shot(B, '07-brunch-closeup-dj')

  // ── map with now-playing tags and "next on your plan" ──
  await B.locator('nav.tabbar button', { hasText: 'Map' }).click()
  await shot(B, '08-map-now-playing-next')

  // ── Lara sees Barbara's shared plan on Barbara's profile ──
  await refresh(L)
  await L.locator('nav.tabbar button', { hasText: 'Crew' }).click()
  await L.getByRole('button', { name: /^Barbara/ }).first().click()
  check(await L.getByText('Barbara’s night').isVisible(), 'shared plan shows on Barbara’s profile page')
  await shot(L, '09-lara-sees-barbaras-plan')
  await L.getByRole('button', { name: 'Close' }).click()

  // ── Barbara mutes Lara ──
  await B.locator('nav.tabbar button', { hasText: 'Crew' }).click()
  await B.getByRole('button', { name: 'Mute Lara', exact: true }).click()
  await B.waitForTimeout(1500)
  await shot(B, '10-crew-tab-group-mute')

  // ── Mar wanders off: Barbara lets Mar go, guessing the WC ──
  await B.getByRole('button', { name: /^Mar/ }).first().click()
  await shot(B, '11-mar-profile-buddied')
  await B.getByRole('button', { name: 'Let go' }).click()
  await B.getByRole('button', { name: /WC/ }).first().click()
  await shot(B, '12-let-go-sheet')
  await B.getByRole('button', { name: 'Let go' }).last().click()
  await B.waitForTimeout(1500)
  check((await sql(`select buddy from members where name = 'Mar'`))[0].buddy === null, 'Mar is out of the group')
  await B.locator('nav.tabbar button', { hasText: 'Map' }).click().catch(() => {})
  await B.getByRole('button', { name: 'Close' }).click().catch(() => {})
  await B.locator('nav.tabbar button', { hasText: 'Map' }).click()
  await shot(B, '13-map-mar-probably-at-wc')

  // ── Barbara plans a move with Lara: WC in 10 min ──
  await B.locator('nav.tabbar button', { hasText: 'Crew' }).click()
  await B.getByRole('button', { name: 'Plan a move' }).click()
  await B.locator('button', { hasText: 'Lara' }).last().click()
  await B.getByRole('button', { name: /^WC$/ }).click()
  await shot(B, '14-plan-a-move')
  await B.getByRole('button', { name: 'Send' }).click()
  await B.waitForTimeout(1500)
  await refresh(L)
  await shot(L, '15-lara-move-banner')
  check(await L.getByText(/in 10 min|in 9 min/).first().isVisible(), 'Lara sees “WC in 10 min”')

  // ── 10 minutes later: faded penguins at the WC, waiting to be confirmed ──
  for (const p of [B, L]) await p.clock.fastForward('10:30')
  await sql(`update reminders set due_at = now() - interval '5 seconds' where kind = 'move'`) // the server's clock is real
  await L.waitForTimeout(1500)
  await shot(L, '16-lara-meet-at-wc-suggested')
  await L.getByRole('button', { name: 'I’m here' }).click()
  await L.waitForTimeout(1500)
  await B.getByRole('button', { name: 'Close' }).click().catch(() => {})
  await B.locator('nav.tabbar button', { hasText: 'Map' }).click()
  await B.waitForTimeout(1500)
  await shot(B, '17-barbara-after-lara-confirms')

  // ── what the notification service was asked to send ──
  await B.waitForTimeout(6000)
  const pushes = await (await fetch('http://localhost:54321/_test/pushes')).json()
  const kinds = n => pushes.filter(p => p.to === n).map(p => (p.topic ?? '').replace(/[0-9a-f]{8}.*/, '')).join(' ')
  console.log('   notifications:', JSON.stringify({ Barbara: kinds('Barbara'), Lara: kinds('Lara'), Mar: kinds('Mar') }))
  check(/buddy/.test(kinds('Lara')) && /buddy/.test(kinds('Mar')), 'buddy requests notified')
  check(/move/.test(kinds('Lara')) && !/move/.test(kinds('Mar')), 'planned move notified to Lara only (then the “time to go” reminders)')
  check(/move/.test(kinds('Barbara')), 'Barbara got her own “time to go” reminder')

  // ── mute: Barbara muted Lara, so Lara's chat reaches Mar but not Barbara ──
  const before = pushes.length
  await L.locator('nav.tabbar button', { hasText: 'Chat' }).click()
  await L.getByPlaceholder('Message').fill('anyone want water?')
  await L.getByRole('button', { name: 'Send', exact: true }).click()
  await L.waitForTimeout(4000)
  const after = (await (await fetch('http://localhost:54321/_test/pushes')).json()).slice(before)
  console.log('   after Lara’s message:', JSON.stringify(after.map(p => p.to)))
  check(after.some(p => p.to === 'Mar') && !after.some(p => p.to === 'Barbara'), 'muted: Barbara doesn’t get Lara’s message, Mar does')
  await done()
})().catch(async e => {
  console.error(e)
  process.exit(1)
})
