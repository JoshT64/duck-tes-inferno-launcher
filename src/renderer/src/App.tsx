import { useState, useEffect } from 'react'
import { useElectronAPI } from './hooks/useElectronAPI'
import TopNav from './components/TopNav'
import FirstLaunch from './components/FirstLaunch'
import Home from './pages/Home'
import Changelog from './pages/Changelog'
import ReportBug from './pages/ReportBug'
import Settings from './pages/Settings'

export default function App() {
  const api = useElectronAPI()
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    async function init() {
      const first = await api.isFirstLaunch()
      setIsFirstLaunch(first)
      if (!first) {
        const player = await api.getPlayer()
        setDisplayName(player.displayName)
      }
    }
    init()
  }, [])

  if (isFirstLaunch === null) {
    return <div className="loading">Loading...</div>
  }

  if (isFirstLaunch) {
    return (
      <FirstLaunch
        onComplete={async () => {
          const player = await api.getPlayer()
          setDisplayName(player.displayName)
          setIsFirstLaunch(false)
        }}
      />
    )
  }

  const showSettings = activeTab === 'settings'

  function renderPage() {
    switch (activeTab) {
      case 'changelog':
        return <Changelog />
      case 'report':
        return <ReportBug />
      case 'settings':
        return <Settings />
      default:
        return <Home />
    }
  }

  return (
    <div className="app">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        displayName={displayName}
        onSettingsClick={() => setActiveTab(showSettings ? 'home' : 'settings')}
      />
      <main className="content">{renderPage()}</main>
    </div>
  )
}
