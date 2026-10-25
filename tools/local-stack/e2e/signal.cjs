// Weak signal: does a pin still get out quickly?
const fs = require('fs')
const { sql, phone, join, startCrew, check, done } = require('./lib.cjs')
const knob = q => fetch(`http://localhost:54321/_test/slow?${q}`)
const pinCount = async () => +(await sql('select count(*) n from checkins'))[0].n
async function timeToServer(before, limit = 40000) {
  const t0 = Date.now()
  while (Date.now() - t0 < limit) {
    if ((await pinCount()) > before) return Date.now() - t0
    await new Promise(r => setTimeout(r, 250))
  }
  return null
}
;(async () => {
  const B = await phone('Barbara', null, { lowData: true })
  const code = await startCrew(B, 'signal', 'Halloween')
  await B.getByPlaceholder('What your crew calls you').fill('Barbara')
  await B.getByRole('button', { name: 'Join crew' }).click()
  await B.locator('nav.tabbar').waitFor()
  await B.getByRole('button', { name: 'Pin', exact: true }).click()
  await B.waitForTimeout(1000)

  // 1. One request gets stuck (a dead connection after the phone was in a pocket).
  let n = await pinCount()
  await knob('hangNext=60000')
  await B.mouse.click(120, 420)
  let t = await timeToServer(n)
  console.log(`   stuck request: pin reached the server after ${t} ms`)
  check(t != null && t < 14000, 'a stuck request is given up after 10 s and retried (was 20 s + 2 s)')

  // 2. No signal for a while, then it comes back.
  n = await pinCount()
  await knob('down=1')
  await B.mouse.click(270, 460)
  await B.waitForTimeout(12000)
  await knob('down=0')
  t = await timeToServer(n)
  console.log(`   signal back: pin reached the server ${t} ms later`)
  check(t != null && t < 11000, 'when signal comes back, the pin goes within the 10 s retry')

  // 3. A photo is stuck uploading: the pin must not wait behind it.
  await knob('storage=25000')
  await B.locator('nav.tabbar button', { hasText: 'Chat' }).click()
  fs.writeFileSync('/opt/e2e/photo.jpg', Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64'))
  await B.locator('input[type=file]').setInputFiles('/opt/e2e/photo.jpg')
  await B.waitForTimeout(1500)
  n = await pinCount()
  await B.getByRole('button', { name: 'Pin', exact: true }).click()
  await B.mouse.click(195, 500)
  t = await timeToServer(n)
  console.log(`   with a photo stuck uploading: pin reached the server after ${t} ms`)
  check(t != null && t < 3000, 'pins go out before photos (a stuck photo doesn’t hold up your pin)')
  await knob('storage=0')
  await done()
})().catch(e => { console.error(e); process.exit(1) })
