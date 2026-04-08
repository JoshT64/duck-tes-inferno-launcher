import { ipcMain, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import got from 'got'
import { randomUUID } from 'node:crypto'
import store from './store'
import { LEADERBOARD_API_URL } from './config'
import {
  fetchLatestRelease,
  fetchAllReleases,
  isUpdateAvailable,
  downloadAndInstall
} from './updater'
import { launchGame, isGameRunning } from './launcher'
import { submitBugReport, submitCrashReport } from './reporter'

export function setupIPC(mainWindow: BrowserWindow): void {
  // Update checks
  ipcMain.handle('check-for-update', async () => {
    try {
      const release = await fetchLatestRelease()
      const available = isUpdateAvailable(release.tag_name)
      return { available, version: release.tag_name, changelog: release.body }
    } catch (err) {
      return { available: false, error: String(err) }
    }
  })

  ipcMain.handle('start-update', async () => {
    const release = await fetchLatestRelease()
    await downloadAndInstall(release, mainWindow)
  })

  // Game launching
  ipcMain.handle('launch-game', async () => {
    if (isGameRunning()) {
      return { success: false, error: 'Game is already running' }
    }
    try {
      await launchGame(mainWindow)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Player identity
  ipcMain.handle('get-player', () => ({
    playerId: store.get('playerId'),
    displayName: store.get('displayName')
  }))

  ipcMain.handle('register-player', async (_event, displayName: string) => {
    try {
      const playerId = randomUUID()
      await got.post(`${LEADERBOARD_API_URL}/api/players`, {
        json: { id: playerId, displayName },
        responseType: 'json'
      })
      store.set('playerId', playerId)
      store.set('displayName', displayName)
      return { success: true, playerId }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('update-display-name', async (_event, displayName: string) => {
    try {
      const playerId = store.get('playerId')
      await got.patch(`${LEADERBOARD_API_URL}/api/players/${playerId}`, {
        json: { displayName },
        responseType: 'json'
      })
      store.set('displayName', displayName)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Releases
  ipcMain.handle('fetch-releases', async () => {
    try {
      return await fetchAllReleases()
    } catch {
      return []
    }
  })

  // Bug reporting
  ipcMain.handle(
    'submit-bug-report',
    async (
      _event,
      {
        title,
        description,
        includeLog
      }: { title: string; description: string; includeLog: boolean }
    ) => {
      return await submitBugReport(title, description, includeLog)
    }
  )

  ipcMain.handle(
    'submit-crash-report',
    async (
      _event,
      {
        exitCode,
        playerLog,
        systemInfo
      }: { exitCode: number; playerLog: string; systemInfo: Record<string, string> }
    ) => {
      return await submitCrashReport(exitCode, playerLog, systemInfo)
    }
  )

  // Settings
  ipcMain.handle('get-settings', () => ({
    installPath: store.get('installPath'),
    autoUpdate: store.get('autoUpdate'),
    gameVersion: store.get('gameVersion')
  }))

  ipcMain.handle(
    'update-setting',
    (_event, { key, value }: { key: string; value: unknown }) => {
      const allowedKeys = ['installPath', 'autoUpdate']
      if (!allowedKeys.includes(key)) {
        return { success: false, error: 'Invalid setting key' }
      }
      store.set(key as 'installPath' | 'autoUpdate', value as string & boolean)
      return { success: true }
    }
  )

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // First launch
  ipcMain.handle('is-first-launch', () => {
    return !store.get('playerId')
  })

  // Window controls
  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-close', () => mainWindow.close())
}
