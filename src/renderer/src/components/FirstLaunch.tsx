import { useState, ReactElement } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'

interface FirstLaunchProps {
  onComplete: () => void
}

export default function FirstLaunch({ onComplete }: FirstLaunchProps): ReactElement {
  const api = useElectronAPI()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isValid = displayName.length >= 3 && displayName.length <= 16

  async function handleSubmit(): Promise<void> {
    if (!isValid) return
    setLoading(true)
    setError('')

    const result = await api.registerPlayer(displayName)
    if (result.success) {
      onComplete()
    } else {
      setError(result.error || 'Registration failed')
      setLoading(false)
    }
  }

  return (
    <div className="first-launch">
      <h1>Welcome to Duckte&apos;s Inferno</h1>
      <p>Set up your launcher to get started.</p>

      <label>
        Display Name (3-16 characters)
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={16}
          placeholder="Enter your name"
        />
      </label>
      <span className="char-count">{displayName.length}/16</span>

      {error && <p className="error">{error}</p>}

      <button className="primary-button" disabled={!isValid || loading} onClick={handleSubmit}>
        {loading ? 'Setting up...' : 'Get Started'}
      </button>
    </div>
  )
}
