// Loaded into the app's service worker. Shows crew notifications and opens
// the right screen when one is tapped.

self.addEventListener('push', event => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { title: 'Crew', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(d.title || 'Crew', {
        body: d.body || '',
        tag: d.tag,
        renotify: !!d.urgent,
        requireInteraction: !!d.urgent,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { open: d.open, member: d.member },
      })
      // If the app is open, have it pull the news right away.
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      list.forEach(c => c.postMessage({ type: 'refresh' }))
    })(),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const { open, member } = event.notification.data || {}
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of list) {
        c.postMessage({ type: 'open', open, member })
        return c.focus()
      }
      const q = new URLSearchParams({ open: open || 'map' })
      if (member) q.set('member', member)
      return self.clients.openWindow('/?' + q)
    })(),
  )
})
