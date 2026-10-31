// This round's preview, on iPhone 17-sized phones: tour, invite code, badges, new looks, layout.
const { sql, phone, join, refresh, shot, check, done, APP } = require('./lib.cjs')

const IPHONE = { width: 402, height: 874 }
const T = '2026-10-31T20:40:00+01:00'
const tab = (p, name) => p.locator('nav.tabbar button', { hasText: name }).click()

;(async () => {
  const B = await phone('Barbara', T, { viewport: IPHONE, tour: true })
  await B.goto(APP)
  await B.getByRole('button', { name: 'Start a crew' }).click().catch(() => {})
  await B.getByPlaceholder('Crew name, e.g. Saturday squad').fill('Halloween squad')
  check((await B.getByLabel('Invite code').inputValue()) === 'halloween-squad', 'invite code suggested from the crew name')
  await shot(B, 'p01-start-invite-code')
  await B.getByLabel('Invite code').fill('bruja-squad')
  await B.getByRole('button', { name: 'Create crew' }).click()
  await B.getByPlaceholder('What your crew calls you').fill('Barbara')
  await B.getByRole('button', { name: 'Join crew' }).click()
  check((await sql('select invite_code from crews'))[0]?.invite_code === 'bruja-squad', 'crew created with the edited code')

  // The tour, once, after joining
  await B.getByRole('dialog', { name: 'Welcome to PinGü' }).waitFor()
  await shot(B, 'p02-tour-first', { wait: 900 })
  for (let i = 0; i < 3; i++) await B.getByRole('button', { name: 'Next' }).click(), await B.waitForTimeout(700)
  await shot(B, 'p03-tour-sets')
  await B.getByRole('button', { name: 'Next' }).click()
  await B.waitForTimeout(700)
  check(await B.getByRole('button', { name: 'Let’s go' }).isVisible(), 'tour ends on “Let’s go”')
  await B.getByRole('button', { name: 'Skip' }).click()
  await B.reload()
  await B.locator('nav.tabbar').waitFor()
  await B.waitForTimeout(800)
  check(!(await B.getByRole('dialog', { name: 'Welcome to PinGü' }).isVisible()), 'tour shows only once')

  const L = await phone('Lara', T, { viewport: IPHONE })
  const M = await phone('Mar', T, { viewport: IPHONE })
  await join(L, 'bruja-squad', 'Lara')
  await join(M, 'bruja-squad', 'Mar')
  await sql(`update members set color = case name when 'Barbara' then '#d23bff' when 'Lara' then '#b6ff3b' else '#ffc83b' end, acc = case name when 'Barbara' then 11 when 'Lara' then 10 else 15 end`)

  // Everyone pins at a different stage
  for (const [p, stage, x] of [[B, 'elrow', 200], [L, 'Brunch!', 150], [M, 'The Jail', 250]]) {
    await refresh(p)
    await tab(p, 'Pin')
    await p.getByRole('button', { name: new RegExp(`^${stage.replace('!', '!')}`) }).first().click()
    await p.waitForTimeout(400)
    await p.mouse.click(x, 560)
    await p.waitForTimeout(800)
  }
  await refresh(B)
  await tab(B, 'Map')
  await shot(B, 'p04-map-half-badges', { wait: 1200 })
  const mapBox = await B.locator('.screen').first().boundingBox()
  console.log('   screen height', mapBox.height)

  // Profile: new colours, accessories, and the badge switch
  await B.getByRole('button', { name: 'Your profile' }).click()
  await shot(B, 'p05-profile-picker', { wait: 600 })
  await B.getByRole('radio', { name: 'Status' }).scrollIntoViewIfNeeded()
  await B.getByRole('radio', { name: 'Status' }).click()
  await shot(B, 'p06-profile-toggle')
  await B.getByRole('button', { name: 'Done' }).click()
  await shot(B, 'p07-map-status-badges', { wait: 600 })
  await B.getByRole('button', { name: 'Your profile' }).click()
  await B.getByRole('radio', { name: 'Where' }).click()
  await B.getByRole('button', { name: 'Done' }).click()

  // Pin page: rounded DJ screen, floor fits above the footer
  await tab(B, 'Pin')
  await B.getByRole('button', { name: /^elrow/ }).first().click()
  await shot(B, 'p08-pin-elrow', { wait: 800 })
  const floor = await B.locator('.screen').first().evaluate(el => el.scrollHeight - el.clientHeight)
  check(floor <= 2, `stage page fits the screen without scrolling (overflow ${floor}px)`)

  // Lineup: same height on every stage, rows inside the margins
  await B.locator('button.dj').click()
  await B.locator('.dj-tabs button', { hasText: 'elrow' }).click()
  await shot(B, 'p09-lineup-elrow', { wait: 600 })
  const h1 = (await B.locator('.dj-sheet').boundingBox()).height
  await B.locator('.dj-tabs button', { hasText: 'Brunch!' }).click()
  await shot(B, 'p10-lineup-brunch', { wait: 600 })
  const h2 = (await B.locator('.dj-sheet').boundingBox()).height
  check(Math.abs(h1 - h2) < 1 && Math.abs(h1 - IPHONE.height / 2) < 2, `lineup is half the screen on every stage (${h1} / ${h2})`)
  const rows = await B.locator('.dj-row').evaluateAll(els => els.map(e => e.getBoundingClientRect().right))
  check(rows.every(r => r <= IPHONE.width - 17), 'lineup rows stay inside the margins')
  await B.getByRole('button', { name: 'Close' }).click()

  await tab(B, 'Crew')
  await shot(B, 'p11-crew-badges', { wait: 600 })

  // Mondo, for comparison
  const X = await phone('Mondo', '2026-10-25T01:30:00+02:00', { viewport: IPHONE })
  await X.goto(APP)
  await X.getByRole('button', { name: 'Start a crew' }).click().catch(() => {})
  await X.getByRole('radio', { name: /Mondo Disko/ }).click()
  await X.getByPlaceholder('Crew name, e.g. Saturday squad').fill('mondo test')
  await X.getByRole('button', { name: 'Create crew' }).click()
  await X.getByPlaceholder('What your crew calls you').fill('Barbara')
  await X.getByRole('button', { name: 'Join crew' }).click()
  await X.locator('nav.tabbar').waitFor()
  await shot(X, 'p12-mondo-map', { wait: 1200 })
  await done()
})().catch(e => {
  console.error(e)
  process.exit(1)
})
