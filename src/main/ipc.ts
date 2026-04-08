import { ipcMain, dialog, net } from 'electron'
import type { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import store from './store'
import { LEADERBOARD_API_URL, getDefaultInstallPath } from './config'
import {
  fetchLatestRelease,
  fetchAllReleases,
  isUpdateAvailable,
  downloadAndInstall
} from './updater'
import { launchGame, isGameRunning } from './launcher'
import { submitBugReport, submitCrashReport } from './reporter'

/** Helper: make HTTP request using Electron's net module */
function netRequest(method: string, url: string, body?: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method, url })
    request.setHeader('Content-Type', 'application/json')
    request.setHeader('User-Agent', 'DuckteInferno-Launcher')
    request.on('response', (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        let data = ''
        response.on('data', (chunk) => { data += chunk.toString() })
        response.on('end', () => reject(new Error(`HTTP ${response.statusCode}: ${data}`)))
        return
      }
      response.on('data', () => {})
      response.on('end', () => resolve())
    })
    request.on('error', reject)
    if (body) request.write(JSON.stringify(body))
    request.end()
  })
}

export function setupIPC(mainWindow: BrowserWindow): void {
  // Update checks
  ipcMain.handle('check-for-update', async () => {
    try {
      const release = await fetchLatestRelease()
      const available = isUpdateAvailable(release.tag_name)
      return { available, version: release.tag_name, changelog: release.body }
    } catch (err) {
      console.error('check-for-update failed:', err)
      return { available: false, error: String(err) }
    }
  })

  ipcMain.handle('start-update', async () => {
    try {
      const release = await fetchLatestRelease()
      await downloadAndInstall(release, mainWindow)
    } catch (err) {
      console.error('start-update failed:', err)
      throw err
    }
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
      await netRequest('POST', `${LEADERBOARD_API_URL}/api/players`, { id: playerId, displayName })
      store.set('playerId', playerId)
      store.set('displayName', displayName)

      // Set default install path if not already set
      if (!store.get('installPath')) {
        store.set('installPath', getDefaultInstallPath())
      }

      return { success: true, playerId }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('update-display-name', async (_event, displayName: string) => {
    try {
      const playerId = store.get('playerId')
      await netRequest('PATCH', `${LEADERBOARD_API_URL}/api/players/${playerId}`, { displayName })
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
    } catch (err) {
      console.error('fetch-releases failed:', err)
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
