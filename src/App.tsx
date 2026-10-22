import { useEffect } from 'react'
import { store, useStore } from './lib/store'
import { TabBar, Toast } from './components/common'
import { MapScreen } from './screens/MapScreen'
import { StageScreen } from './screens/StageScreen'
import { ChatScreen } from './screens/ChatScreen'
import { CrewScreen, FindScreen } from './screens/CrewScreen'
import { ShortcutScreen } from './screens/ShortcutScreen'
import { SosScreen, StatusSheet } from './screens/Overlays'
import { Join, Unconfigured, Welcome } from './screens/Onboarding'

export default function App() {
  const s = useStore()
  useEffect(() => {
    store.boot()
  }, [])

  const screen = s.ui.screen
  return (
    <div className="app">
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
          <StatusSheet key={String(s.ui.sheet)} />
          <SosScreen />
        </>
      )}
      <Toast />
    </div>
  )
}
