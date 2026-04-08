import { useState } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'
import type { CrashData } from '../types'

interface CrashDialogProps {
  crashData: CrashData
  onDismiss: () => void
}

export default function CrashDialog({ crashData, onDismiss }: CrashDialogProps) {
  const api = useElectronAPI()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    setSending(true)
    await api.submitCrashReport(crashData.exitCode, crashData.playerLog, crashData.systemInfo)
    setSent(true)
    setSending(false)
  }

  return (
    <div className="crash-overlay">
      <div className="crash-dialog">
        <h2>Game Crashed</h2>
        <p>The game exited unexpectedly (exit code: {crashData.exitCode}).</p>
        <details>
          <summary>View log excerpt</summary>
          <pre className="crash-log">{crashData.playerLog.slice(-500)}</pre>
        </details>
        <div className="crash-actions">
          {sent ? (
            <p className="crash-sent">Crash report sent. Thanks!</p>
          ) : (
            <button className="primary-button" disabled={sending} onClick={handleSend}>
              {sending ? 'Sending...' : 'Send Crash Report'}
            </button>
          )}
          <button onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  )
}
