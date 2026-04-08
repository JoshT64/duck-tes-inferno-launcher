import { useState, useEffect } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'

export default function Settings() {
  const api = useElectronAPI()
  const [displayName, setDisplayName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [installPath, setInstallPath] = useState('')
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [gameVersion, setGameVersion] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const player = await api.getPlayer()
      setDisplayName(player.displayName)
      setOriginalName(player.displayName)
      const settings = await api.getSettings()
      setInstallPath(settings.installPath)
      setAutoUpdate(settings.autoUpdate)
      setGameVersion(settings.gameVersion)
    }
    load()
  }, [])

  async function handleSaveName() {
    if (displayName === originalName) return
    if (displayName.length < 3 || displayName.length > 16) return
    setSaving(true)
    const result = await api.updateDisplayName(displayName)
    if (result.success) {
      setOriginalName(displayName)
      setMessage('Name updated!')
      setTimeout(() => setMessage(''), 3000)
    } else {
      setMessage(result.error || 'Failed to update name')
    }
    setSaving(false)
  }

  async function handleBrowse() {
    const path = await api.selectDirectory()
    if (path) {
      setInstallPath(path)
      await api.updateSetting('installPath', path)
    }
  }

  async function handleAutoUpdate(checked: boolean) {
    setAutoUpdate(checked)
    await api.updateSetting('autoUpdate', checked)
  }

  async function handleCheckUpdate() {
    const result = await api.checkForUpdate()
    if (result.available) {
      setMessage(`Update available: ${result.version}`)
    } else {
      setMessage('You are up to date!')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const nameChanged = displayName !== originalName
  const nameValid = displayName.length >= 3 && displayName.length <= 16

  return (
    <div className="page settings-page">
      <h2>Settings</h2>
      <section>
        <h3>Profile</h3>
        <label>
          Display Name
          <div className="inline-edit">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={16}
            />
            {nameChanged && (
              <button disabled={!nameValid || saving} onClick={handleSaveName}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </label>
      </section>
      <section>
        <h3>Game</h3>
        <label>
          Install Location
          <div className="path-picker">
            <input type="text" value={installPath} readOnly />
            <button onClick={handleBrowse}>Browse</button>
          </div>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={(e) => handleAutoUpdate(e.target.checked)}
          />
          Auto-update game on launch
        </label>
        <div className="version-info">
          <span>Game version: {gameVersion || 'Not installed'}</span>
          <button onClick={handleCheckUpdate}>Check for Updates</button>
        </div>
      </section>
      {message && <p className="settings-message">{message}</p>}
    </div>
  )
}
