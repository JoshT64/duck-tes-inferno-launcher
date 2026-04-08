import { useState } from 'react'
import { useElectronAPI } from '../hooks/useElectronAPI'

export default function ReportBug() {
  const api = useElectronAPI()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [includeLog, setIncludeLog] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    setError('')
    const result = await api.submitBugReport(title, description, includeLog)
    if (result.success) {
      setSubmitted(true)
      setTitle('')
      setDescription('')
    } else {
      setError(result.error || 'Failed to submit report')
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="page report-page">
        <div className="report-success">
          <h2>Bug Report Sent</h2>
          <p>Thanks for the report! The team has been notified.</p>
          <button onClick={() => setSubmitted(false)}>Submit Another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page report-page">
      <h2>Report a Bug</h2>
      <label>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief description of the issue"
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? What did you expect? Steps to reproduce?"
          rows={6}
        />
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={includeLog}
          onChange={(e) => setIncludeLog(e.target.checked)}
        />
        Attach game log (Player.log — last 200 lines)
      </label>
      {error && <p className="error">{error}</p>}
      <button
        className="primary-button"
        disabled={!title.trim() || !description.trim() || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Sending...' : 'Submit Bug Report'}
      </button>
    </div>
  )
}
