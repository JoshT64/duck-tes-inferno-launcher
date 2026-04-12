import { net } from 'electron'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import store from './store'
import { SUPABASE_FUNCTIONS_URL, getUnityLogPath, getGameDataDir } from './config'

const LAUNCHER_API_URL = `${SUPABASE_FUNCTIONS_URL}/launcher-api`

interface GameFile {
  filename: string
  content: string
}

interface BugReportPayload {
  playerId: string
  title: string
  description: string
  playerLog?: string
  gameFiles?: GameFile[]
  systemInfo?: Record<string, string>
  gameVersion?: string
}

interface CrashReportPayload {
  playerId: string
  exitCode: number
  playerLog?: string
  gameFiles?: GameFile[]
  systemInfo?: Record<string, string>
  gameVersion?: string
}

/** POST JSON using Electron's net module */
function postJSON(url: string, body: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'POST', url })
    request.setHeader('Content-Type', 'application/json')
    request.setHeader('User-Agent', 'DuckteInferno-Launcher')

    request.on('response', (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode} from ${url}`))
        return
      }
      // Consume response
      response.on('data', () => {})
      response.on('end', () => resolve())
    })
    request.on('error', reject)
    request.write(JSON.stringify(body))
    request.end()
  })
}

const GAME_DATA_FILES = [
  'Player.log',
  'Player-prev.log',
  'quests/quests_progress.json',
  'Inventory_save.json',
  'inventory'
]

const MAX_FILE_SIZE = 512 * 1024 // 512 KB per file

async function getPlayerLog(): Promise<string> {
  try {
    const fullLog = await fsp.readFile(getUnityLogPath(), 'utf-8')
    const lines = fullLog.split('\n')
    return lines.slice(-200).join('\n')
  } catch {
    return 'Could not read Player.log'
  }
}

async function collectGameFiles(): Promise<GameFile[]> {
  const gameDataDir = getGameDataDir()
  const files: GameFile[] = []

  for (const filename of GAME_DATA_FILES) {
    try {
      const filePath = path.join(gameDataDir, filename)
      const stat = await fsp.stat(filePath)
      if (!stat.isFile()) continue

      let content = await fsp.readFile(filePath, 'utf-8')
      if (content.length > MAX_FILE_SIZE) {
        // For large files, keep the tail (most recent data)
        content = content.slice(-MAX_FILE_SIZE)
      }
      files.push({ filename, content })
    } catch {
      // File doesn't exist or can't be read — skip it
    }
  }

  return files
}

function getSystemInfo(): Record<string, string> {
  return {
    os: os.platform(),
    osVersion: os.release(),
    arch: os.arch(),
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`
  }
}

export async function submitBugReport(
  title: string,
  description: string,
  includeLog: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: BugReportPayload = {
      playerId: store.get('playerId'),
      title,
      description,
      systemInfo: getSystemInfo(),
      gameVersion: store.get('gameVersion') || 'unknown'
    }

    if (includeLog) {
      payload.playerLog = await getPlayerLog()
      payload.gameFiles = await collectGameFiles()
    }

    await postJSON(`${LAUNCHER_API_URL}/api/bug-reports`, payload)
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function submitCrashReport(
  exitCode: number,
  playerLog: string,
  systemInfo: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: CrashReportPayload = {
      playerId: store.get('playerId'),
      exitCode,
      playerLog,
      systemInfo,
      gameVersion: store.get('gameVersion') || 'unknown'
    }

    await postJSON(`${LAUNCHER_API_URL}/api/crash-reports`, payload)
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
