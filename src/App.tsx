import { useEffect } from 'react'
import { store, useStore } from './lib/store'
import { TabBar, Toast } from './components/common'
import { MapScreen } from './screens/MapScreen'
import { StageScreen } from './screens/StageScreen'
import { ChatScreen } from './screens/ChatScreen'
import { CrewScreen, FindScreen } from './screens/CrewScreen'
import { ShortcutScreen } from './screens/ShortcutScreen'
import { ProfileSheet, SosScreen } from './screens/Overlays'
import { Join, Unconfigured, Welcome } from './screens/Onboarding'

export default function App() {
  const s = useStore()
  useEffect(() => {
    store.boot()
  }, [])
  // Fetch every floor plan of your venue once (kept by the service worker), so
  // switching floors works later with no signal.
  const plans = (s.venue?.floors ?? []).map(f => f.map_url).join(' ')
  useEffect(() => {
    if (plans) plans.split(' ').forEach(u => (new Image().src = u))
  }, [plans])

  const screen = s.ui.screen
  const me = s.members.find(m => m.id === s.session?.memberId)
  return (
    <div className="app" style={{ ['--aura' as string]: me?.color ?? '#a98bff' }}>
      {s.phase === 'unconfigured' && <Unconfigured />}
      {s.phase === 'welcome' && <Welcome />}
      {s.phase === 'join' && <Join />}
      {s.phase === 'ready' && (
        <>
          {screen === 'map' && <MapScreen />}
          {screen === 'stage' && <StageScreen />}
          {screen === 'chat' && <ChatScreen />}
          {screen === 'crew' && <CrewScreen />}
          {screen === 'shortcut' && <ShortcutScreen />}
          {screen === 'find' && <FindScreen />}
          {screen !== 'find' && <TabBar />}
          <ProfileSheet key={String(s.ui.sheet)} />
          <SosScreen />
        </>
      )}
      <Toast />
    </div>
  )
}
