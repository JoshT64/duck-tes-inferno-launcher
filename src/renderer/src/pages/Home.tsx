import { useState, useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import PlayButton from '../components/PlayButton'
import UpdateOverlay from '../components/UpdateOverlay'
import NewsCard from '../components/NewsCard'
import type { Release, GameState, DownloadProgress, DownloadStatus } from '../types'

export default function Home() {
  const api = useElectronAPI()
  const [releases, setReleases] = useState<Release[]>([])
  const [gameState, setGameState] = useState<GameState>('stopped')
  const [gameVersion, setGameVersion] = useState('')
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({ percent: 0, transferred: 0, total: 0 })
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('downloading')
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    async function init() {
      const allReleases = await api.fetchReleases()
      setReleases(allReleases)

      const settings = await api.getSettings()
      setGameVersion(settings.gameVersion)

      const update = await api.checkForUpdate()
      if (update.available) {
        setUpdateAvailable(true)
        if (!settings.gameVersion) {
          setGameState('installing')
        }
      }
    }
    init()

    api.onDownloadProgress((data) => {
      setDownloadProgress(data)
      setGameState('updating')
    })

    api.onDownloadStatus((status) => {
      setDownloadStatus(status as DownloadStatus)
      if (status === 'complete') {
        setGameState('stopped')
        setUpdateAvailable(false)
        api.getSettings().then((s) => setGameVersion(s.gameVersion))
      }
    })

    api.onGameState((state) => {
      setGameState(state as GameState)
    })
  }, [])

  async function handlePlay() {
    if (updateAvailable || gameState === 'installing') {
      setGameState('updating')
      setDownloadStatus('downloading')
      await api.startUpdate()
    } else {
      await api.launchGame()
    }
  }

  const isUpdating = gameState === 'updating'
  const latestRelease = releases[0]

  return (
    <div className="page home-page">
      <div className="hero-banner">
        {latestRelease && (
          <>
            <h2>{latestRelease.name || latestRelease.tag_name}</h2>
            <p>{latestRelease.body.substring(0, 200)}</p>
          </>
        )}
      </div>

      {isUpdating && <UpdateOverlay progress={downloadProgress} status={downloadStatus} />}

      <div className="news-grid">
        {releases.slice(0, 3).map((release) => (
          <NewsCard key={release.tag_name} release={release} />
        ))}
      </div>

      <PlayButton
        gameState={updateAvailable && gameState === 'stopped' ? 'installing' : gameState}
        updatePercent={downloadProgress.percent}
        gameVersion={gameVersion}
        onPlay={handlePlay}
      />
    </div>
  )
}
