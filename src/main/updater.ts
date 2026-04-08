import { BrowserWindow, net } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import StreamZip from 'node-stream-zip'
import store from './store'
import { RELEASES_API_URL, VERSION_FILENAME, GITHUB_TOKEN } from './config'

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
    size: number
  }>
}

interface VersionInfo {
  version: string
}

export type { GitHubRelease }

/** Simple JSON GET using Electron's net module (respects proxy, no ESM issues) */
function fetchJSON(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    request.setHeader('User-Agent', 'DuckteInferno-Launcher')
    request.setHeader('Accept', 'application/vnd.github+json')
    if (GITHUB_TOKEN) {
      request.setHeader('Authorization', `Bearer ${GITHUB_TOKEN}`)
    }

    let data = ''
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} from ${url}`))
        return
      }
      response.on('data', (chunk) => { data += chunk.toString() })
      response.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

export async function fetchLatestRelease(): Promise<GitHubRelease> {
  return (await fetchJSON(RELEASES_API_URL)) as GitHubRelease
}

export async function fetchAllReleases(): Promise<GitHubRelease[]> {
  const allReleasesUrl = RELEASES_API_URL.replace('/latest', '')
  return (await fetchJSON(allReleasesUrl)) as GitHubRelease[]
}

export function getInstalledVersion(): string | null {
  const installPath = store.get('installPath')
  if (!installPath) return null

  const versionFile = path.join(installPath, 'DuckteInferno', VERSION_FILENAME)
  try {
    const data = JSON.parse(fs.readFileSync(versionFile, 'utf-8')) as VersionInfo
    return data.version
  } catch {
    return null
  }
}

export function isUpdateAvailable(latestTag: string): boolean {
  const installed = getInstalledVersion()
  return installed !== latestTag
}

/** Download a file with progress using Node https (follows redirects) */
function downloadFile(
  url: string,
  destPath: string,
  onProgress: (transferred: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (requestUrl: string): void => {
      https.get(requestUrl, { headers: { 'User-Agent': 'DuckteInferno-Launcher' } }, (res) => {
        // Follow redirects (GitHub sends 302)
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          doRequest(res.headers.location)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`))
          return
        }

        const total = parseInt(res.headers['content-length'] || '0', 10)
        let transferred = 0
        const file = fs.createWriteStream(destPath)

        res.on('data', (chunk: Buffer) => {
          transferred += chunk.length
          onProgress(transferred, total)
        })

        res.pipe(file)
        file.on('finish', () => { file.close(() => resolve()) })
        file.on('error', reject)
      }).on('error', reject)
    }

    doRequest(url)
  })
}

export async function downloadAndInstall(
  release: GitHubRelease,
  mainWindow: BrowserWindow
): Promise<void> {
  const installPath = store.get('installPath')
  const gameDir = path.join(installPath, 'DuckteInferno')
  const gameFilesDir = path.join(gameDir, 'game')
  const newDir = path.join(gameDir, 'game.new')
  const backupDir = path.join(gameDir, 'game.backup')
  const tempZip = path.join(gameDir, 'game.zip.tmp')

  const zipAsset = release.assets.find((a) => a.name.endsWith('.zip'))
  if (!zipAsset) throw new Error('No zip asset found in release')

  await fsp.mkdir(gameDir, { recursive: true })

  // Download with progress
  await downloadFile(zipAsset.browser_download_url, tempZip, (transferred, total) => {
    const actualTotal = total || zipAsset.size
    mainWindow.webContents.send('download-progress', {
      percent: actualTotal > 0 ? Math.round((transferred / actualTotal) * 100) : 0,
      transferred,
      total: actualTotal
    })
  })

  // Extract
  mainWindow.webContents.send('download-status', 'extracting')
  await fsp.rm(newDir, { recursive: true, force: true })
  await fsp.mkdir(newDir, { recursive: true })

  const zip = new StreamZip.async({ file: tempZip, skipEntryNameValidation: true })
  await zip.extract(null, newDir)
  await zip.close()

  // Atomic swap
  mainWindow.webContents.send('download-status', 'installing')
  await fsp.rm(backupDir, { recursive: true, force: true })

  if (fs.existsSync(gameFilesDir)) {
    await fsp.rename(gameFilesDir, backupDir)
  }

  await fsp.rename(newDir, gameFilesDir)

  // Write version file
  const versionData: VersionInfo = { version: release.tag_name }
  await fsp.writeFile(
    path.join(gameDir, VERSION_FILENAME),
    JSON.stringify(versionData, null, 2)
  )

  store.set('gameVersion', release.tag_name)

  // Cleanup
  await fsp.rm(tempZip, { force: true })
  await fsp.rm(backupDir, { recursive: true, force: true })

  mainWindow.webContents.send('download-status', 'complete')
}
