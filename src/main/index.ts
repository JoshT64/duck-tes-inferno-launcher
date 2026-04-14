import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIPC } from './ipc'
import store from './store'
import { getDefaultInstallPath } from './config'
import { checkAndApplyLauncherUpdate } from './launcher-updater'
import { setQuitting, isQuitting, isGameDownloading } from './app-state'
import { fetchLatestRelease, isUpdateAvailable } from './updater'

// Suppress "Object has been destroyed" errors from in-flight HTTP responses during shutdown.
process.on('uncaughtException', (err) => {
  if (err.message?.includes('Object has been destroyed')) return
  console.error('Uncaught exception:', err)
})

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 680,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setupIPC(mainWindow)
  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.duckteinferno.launcher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Ensure install path is set
  if (!store.get('installPath')) {
    store.set('installPath', getDefaultInstallPath())
  }

  const mainWindow = createWindow()

  // Single unified poll: launcher update takes priority over game update.
  // They NEVER run at the same time.
  let polling = false
  const poll = async (): Promise<void> => {
    if (polling || isQuitting() || mainWindow.isDestroyed()) return
    polling = true
    try {
      // Step 1: Check launcher update (production only)
      if (!is.dev) {
        const restarting = await checkAndApplyLauncherUpdate(mainWindow)
        if (restarting) return // App is quitting, stop everything
      }

      // Step 2: Only check game update if launcher is up to date and no game download active
      if (!isGameDownloading() && !isQuitting() && !mainWindow.isDestroyed()) {
        try {
          const release = await fetchLatestRelease()
          if (!isQuitting() && !mainWindow.isDestroyed() && isUpdateAvailable(release.tag_name)) {
            mainWindow.webContents.send('update-available', {
              version: release.tag_name,
              changelog: release.body
            })
          }
        } catch {
          // Game update check failed — will retry next tick
        }
      }
    } catch {
      // Launcher update check failed — will retry next tick
    } finally {
      polling = false
    }
  }

  // Run immediately on startup, then every 15 seconds
  poll()
  setInterval(poll, 15_000)

  app.on('before-quit', () => setQuitting())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
