import { useState, useEffect } from 'react'
import { useElectronAPI } from './hooks/useElectronAPI'
import TitleBar from './components/TitleBar'
import TopNav from './components/TopNav'
import FirstLaunch from './components/FirstLaunch'
import CrashDialog from './components/CrashDialog'
import Home from './pages/Home'
import Changelog from './pages/Changelog'
import ReportBug from './pages/ReportBug'
import Settings from './pages/Settings'
import type { CrashData } from './types'

export default function App() {
  const api = useElectronAPI()
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [displayName, setDisplayName] = useState('')
  const [crashData, setCrashData] = useState<CrashData | null>(null)
  const [launcherUpdate, setLauncherUpdate] = useState<{ status: string; version: string; percent: number } | null>(null)

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

    api.onGameCrashed((data) => setCrashData(data))
    api.onLauncherUpdate((data) => setLauncherUpdate(data))
  }, [])

  if (isFirstLaunch === null) {
    return (
      <div className="app">
        <TitleBar />
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (isFirstLaunch) {
    return (
      <div className="app">
        <TitleBar />
        <FirstLaunch
          onComplete={async () => {
            const player = await api.getPlayer()
            setDisplayName(player.displayName)
            setIsFirstLaunch(false)
          }}
        />
      </div>
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
        return <Home onNavigate={setActiveTab} />
    }
  }

  return (
    <div className="app">
      <TitleBar />
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        displayName={displayName}
        onSettingsClick={() => setActiveTab(showSettings ? 'home' : 'settings')}
      />
      <main className="content">{renderPage()}</main>
      {crashData && (
        <CrashDialog crashData={crashData} onDismiss={() => setCrashData(null)} />
      )}
      {launcherUpdate && (
        <div className="launcher-update-banner">
          {launcherUpdate.status === 'downloading'
            ? `Updating launcher to ${launcherUpdate.version}... ${launcherUpdate.percent}%`
            : `Restarting launcher...`}
        </div>
      )}
    </div>
  )
}
