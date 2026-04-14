import { app, shell, BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIPC } from './ipc'
import store from './store'
import { getDefaultInstallPath } from './config'
import { checkAndApplyLauncherUpdate } from './launcher-updater'
import { setQuitting, isQuitting } from './app-state'

// Suppress "Object has been destroyed" errors from in-flight HTTP responses during shutdown
process.on('uncaughtException', (err) => {
  if (isQuitting() && err.message?.includes('Object has been destroyed')) return
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

  // Check for launcher self-update (portable exe swap) on startup + every 15s
  if (!is.dev) {
    let updating = false
    const checkLauncherUpdate = (): void => {
      if (updating || isQuitting()) return
      updating = true
      checkAndApplyLauncherUpdate(mainWindow)
        .catch(() => {})
        .finally(() => { updating = false })
    }
    checkLauncherUpdate()
    setInterval(checkLauncherUpdate, 15_000)
  }

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
