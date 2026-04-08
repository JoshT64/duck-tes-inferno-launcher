import { BrowserWindow } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import got from 'got'
import StreamZip from 'node-stream-zip'
import store from './store'
import { RELEASES_API_URL, VERSION_FILENAME } from './config'

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

export async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await got(RELEASES_API_URL, {
    headers: { 'User-Agent': 'DuckteInferno-Launcher' },
    responseType: 'json'
  })
  return response.body as GitHubRelease
}

export async function fetchAllReleases(): Promise<GitHubRelease[]> {
  const allReleasesUrl = RELEASES_API_URL.replace('/latest', '')
  const response = await got(allReleasesUrl, {
    headers: { 'User-Agent': 'DuckteInferno-Launcher' },
    responseType: 'json'
  })
  return response.body as GitHubRelease[]
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
  const downloadStream = got.stream(zipAsset.browser_download_url, {
    headers: { 'User-Agent': 'DuckteInferno-Launcher' }
  })

  downloadStream.on('downloadProgress', (progress) => {
    mainWindow.webContents.send('download-progress', {
      percent: Math.round((progress.percent || 0) * 100),
      transferred: progress.transferred,
      total: progress.total || zipAsset.size,
      speed: 0
    })
  })

  const writeStream = fs.createWriteStream(tempZip)
  await pipeline(downloadStream, writeStream)

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
