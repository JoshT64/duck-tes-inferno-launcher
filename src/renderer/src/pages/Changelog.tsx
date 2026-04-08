import { useState, useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import type { Release } from '../types'

export default function Changelog() {
  const api = useElectronAPI()
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await api.fetchReleases()
      setReleases(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="page"><p>Loading changelog...</p></div>

  return (
    <div className="page changelog-page">
      <h2>Changelog</h2>
      <div className="changelog-list">
        {releases.map((release) => (
          <div key={release.tag_name} className="changelog-entry">
            <div className="changelog-header">
              <span className="changelog-version">{release.tag_name}</span>
              <span className="changelog-date">
                {new Date(release.published_at).toLocaleDateString()}
              </span>
            </div>
            <h3>{release.name}</h3>
            <div className="changelog-body">
              {release.body.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
