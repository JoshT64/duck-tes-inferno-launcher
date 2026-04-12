import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { spawn } from 'node:child_process'
import { fetchJSON } from './updater'
import { LAUNCHER_RELEASES_API_URL } from './config'

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

  const currentExe = process.execPath
  const exeDir = path.dirname(currentExe)
  const exeName = path.basename(currentExe)
  const updateExe = path.join(exeDir, `${exeName}.update`)
  const oldExe = path.join(exeDir, `${exeName}.old`)
  const batchPath = path.join(exeDir, '_launcher_update.bat')

  // Notify renderer that a launcher update is starting
  mainWindow.webContents.send('launcher-update', {
    status: 'downloading',
    version: release.tag_name,
    percent: 0
  })

  try {
    await downloadFile(
      exeAsset.browser_download_url,
      updateExe,
      (percent) => {
        mainWindow.webContents.send('launcher-update', {
          status: 'downloading',
          version: release.tag_name,
          percent
        })
      },
      exeAsset.size
    )
  } catch {
    // Clean up failed download
    await fsp.rm(updateExe, { force: true })
    return false
  }

  mainWindow.webContents.send('launcher-update', {
    status: 'restarting',
    version: release.tag_name,
    percent: 100
  })

  // Write a batch script that swaps the exe after this process exits
  const script = [
    '@echo off',
    // Wait for the current process to release the exe file
    'timeout /t 2 /nobreak >nul',
    // Remove previous backup if it exists
    `if exist "${oldExe}" del /f "${oldExe}"`,
    // Rename current exe to .old
    `move /y "${currentExe}" "${oldExe}"`,
    // Rename downloaded update to the original name
    `move /y "${updateExe}" "${currentExe}"`,
    // Relaunch
    `start "" "${currentExe}"`,
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
  setTimeout(() => app.quit(), 1500)

  return true
}
