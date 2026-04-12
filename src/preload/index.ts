import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Game updates
  checkForUpdate: (): Promise<{
    available: boolean
    version?: string
    changelog?: string
  }> => ipcRenderer.invoke('check-for-update'),

  startUpdate: (): Promise<void> => ipcRenderer.invoke('start-update'),

  onDownloadProgress: (
    callback: (data: { percent: number; transferred: number; total: number }) => void
  ): void => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data))
  },

  onDownloadStatus: (callback: (status: string) => void): void => {
    ipcRenderer.on('download-status', (_event, status) => callback(status))
  },

  onUpdateAvailable: (
    callback: (data: { version: string; changelog: string }) => void
  ): void => {
    ipcRenderer.on('update-available', (_event, data) => callback(data))
  },

  // Game launching
  launchGame: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('launch-game'),

  onGameState: (callback: (state: string) => void): void => {
    ipcRenderer.on('game-state', (_event, state) => callback(state))
  },

  onGameCrashed: (
    callback: (data: {
      exitCode: number
      playerLog: string
      systemInfo: Record<string, string>
      gameVersion: string
    }) => void
  ): void => {
    ipcRenderer.on('game-crashed', (_event, data) => callback(data))
  },

  // Player identity
  getPlayer: (): Promise<{ playerId: string; displayName: string }> =>
    ipcRenderer.invoke('get-player'),

  registerPlayer: (
    displayName: string
  ): Promise<{ success: boolean; playerId?: string; error?: string }> =>
    ipcRenderer.invoke('register-player', displayName),

  updateDisplayName: (displayName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('update-display-name', displayName),

  // Releases (for news/changelog)
  fetchReleases: (): Promise<
    Array<{ tag_name: string; name: string; body: string; published_at: string }>
  > => ipcRenderer.invoke('fetch-releases'),

  // Bug reporting
  submitBugReport: (
    title: string,
    description: string,
    includeLog: boolean
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('submit-bug-report', { title, description, includeLog }),

  submitCrashReport: (
    exitCode: number,
    playerLog: string,
    systemInfo: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('submit-crash-report', { exitCode, playerLog, systemInfo }),

  // Settings
  getSettings: (): Promise<{ installPath: string; autoUpdate: boolean; gameVersion: string }> =>
    ipcRenderer.invoke('get-settings'),

  updateSetting: (key: string, value: unknown): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('update-setting', { key, value }),

  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),

  // First launch check
  isFirstLaunch: (): Promise<boolean> => ipcRenderer.invoke('is-first-launch'),

  // Launcher self-update notifications
  onLauncherUpdate: (
    callback: (data: { status: string; version: string; percent: number }) => void
  ): void => {
    ipcRenderer.on('launcher-update', (_event, data) => callback(data))
  },

  // Window controls (frameless window)
  minimizeWindow: (): void => {
    ipcRenderer.send('window-minimize')
  },
  closeWindow: (): void => {
    ipcRenderer.send('window-close')
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
