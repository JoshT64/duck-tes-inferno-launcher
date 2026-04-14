import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { spawn } from 'node:child_process'
import { fetchJSON } from './updater'
import { LAUNCHER_RELEASES_API_URL } from './config'
import { isQuitting, setQuitting } from './app-state'

interface GitHubRelease {
  tag_name: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
  }>
}

/** Compare two semver-ish version strings (e.g. "1.1.0" vs "1.2.0") */
function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number)
  const l = local.split('.').map(Number)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0
    const lv = l[i] || 0
    if (rv > lv) return true
    if (rv < lv) return false
  }
  return false
}

/** Download a file with progress, following redirects */
function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void,
  expectedSize?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (requestUrl: string): void => {
      https.get(requestUrl, { headers: { 'User-Agent': 'DuckteInferno-Launcher' } }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          doRequest(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`))
          return
        }

        const total = parseInt(res.headers['content-length'] || '0', 10) || expectedSize || 0
        let transferred = 0
        const file = fs.createWriteStream(destPath)

        res.on('data', (chunk: Buffer) => {
          transferred += chunk.length
          if (onProgress && total > 0) {
            onProgress(Math.round((transferred / total) * 100))
          }
        })

        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', reject)
      }).on('error', reject)
    }
    doRequest(url)
  })
}

/**
 * Check for a launcher update, download it, and swap the exe via a batch script.
 * Returns true if an update was found and the app is about to restart.
 */
export async function checkAndApplyLauncherUpdate(
  mainWindow: BrowserWindow
): Promise<boolean> {
  if (isQuitting()) return false

  const currentVersion = app.getVersion()

  let release: GitHubRelease
  try {
    release = (await fetchJSON(LAUNCHER_RELEASES_API_URL)) as GitHubRelease
  } catch {
    return false
  }

  const remoteVersion = release.tag_name.replace(/^v/, '')
  if (!isNewer(remoteVersion, currentVersion)) {
    return false
  }

  const exeAsset = release.assets.find((a) => a.name.endsWith('.exe'))
  if (!exeAsset) return false

  // PORTABLE_EXECUTABLE_FILE points to the actual portable exe the user ran.
  // process.execPath points to the extracted copy in %TEMP% — not what we want.
  const portableExe = process.env.PORTABLE_EXECUTABLE_FILE
  if (!portableExe) return false // Not running as portable, skip

  const exeDir = path.dirname(portableExe)
  const exeName = path.basename(portableExe)
  const updateExe = path.join(exeDir, `${exeName}.update`)
  const oldExe = path.join(exeDir, `${exeName}.old`)
  const batchPath = path.join(exeDir, '_launcher_update.bat')

  // Notify renderer that a launcher update is starting
  !mainWindow.isDestroyed() && mainWindow.webContents.send('launcher-update', {
    status: 'downloading',
    version: release.tag_name,
    percent: 0
  })

  try {
    await downloadFile(
      exeAsset.browser_download_url,
      updateExe,
      (percent) => {
        !mainWindow.isDestroyed() && mainWindow.webContents.send('launcher-update', {
          status: 'downloading',
          version: release.tag_name,
          percent
        })
      },
      exeAsset.size
    )

    // Verify the download is the right size
    const stat = await fsp.stat(updateExe)
    if (exeAsset.size > 0 && stat.size !== exeAsset.size) {
      throw new Error(`Size mismatch: expected ${exeAsset.size}, got ${stat.size}`)
    }
  } catch {
    // Clean up failed/corrupt download
    await fsp.rm(updateExe, { force: true })
    return false
  }

  !mainWindow.isDestroyed() && mainWindow.webContents.send('launcher-update', {
    status: 'restarting',
    version: release.tag_name,
    percent: 100
  })

  // Write a batch script that waits for the process to exit, then swaps the exe
  const pid = process.pid
  const script = [
    '@echo off',
    // Poll until the launcher process has fully exited
    `:wait`,
    `tasklist /FI "PID eq ${pid}" 2>nul | find "${pid}" >nul`,
    `if not errorlevel 1 (`,
    `  timeout /t 1 /nobreak >nul`,
    `  goto wait`,
    `)`,
    // Extra pause to ensure file handles are released
    'timeout /t 1 /nobreak >nul',
    // Remove previous backup if it exists
    `if exist "${oldExe}" del /f "${oldExe}"`,
    // Rename current portable exe to .old
    `move /y "${portableExe}" "${oldExe}"`,
    // Rename downloaded update to the original name
    `move /y "${updateExe}" "${portableExe}"`,
    // Relaunch the portable exe
    `start "" "${portableExe}"`,
    // Clean up backup and this script
    `del /f "${oldExe}"`,
    `del /f "%~f0"`
  ].join('\r\n')

  await fsp.writeFile(batchPath, script, 'utf-8')

  // Spawn the batch script detached so it outlives this process
  spawn('cmd.exe', ['/c', batchPath], {
    detached: true,
    stdio: 'ignore',
    cwd: exeDir
  }).unref()

  // Give the renderer a moment to show the restart message, then quit
  setQuitting()
  setTimeout(() => app.quit(), 1500)

  return true
}
