import type { DownloadProgress, DownloadStatus } from '../types'

interface UpdateOverlayProps {
  progress: DownloadProgress
  status: DownloadStatus
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function getStatusLabel(status: DownloadStatus): string {
  switch (status) {
    case 'extracting': return 'Extracting files...'
    case 'installing': return 'Installing update...'
    case 'complete': return 'Update complete!'
    default: return 'Downloading update...'
  }
}

export default function UpdateOverlay({ progress, status }: UpdateOverlayProps) {
  return (
    <div className="update-overlay">
      <p className="update-status">{getStatusLabel(status)}</p>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="progress-details">
        <span>{progress.percent}%</span>
        <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
      </div>
    </div>
  )
}
