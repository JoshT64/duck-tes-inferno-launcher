export interface Release {
  tag_name: string
  name: string
  body: string
  published_at: string
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}

export interface CrashData {
  exitCode: number
  playerLog: string
  systemInfo: Record<string, string>
  gameVersion: string
}

export interface PlayerInfo {
  playerId: string
  displayName: string
}

export interface Settings {
  installPath: string
  autoUpdate: boolean
  gameVersion: string
}

export type GameState = 'stopped' | 'running' | 'updating' | 'installing' | 'update-available'
export type DownloadStatus = 'downloading' | 'extracting' | 'installing' | 'complete'
