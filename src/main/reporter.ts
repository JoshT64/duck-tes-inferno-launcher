import got from 'got'
import fsp from 'node:fs/promises'
import os from 'node:os'
import store from './store'
import { SUPABASE_FUNCTIONS_URL, getUnityLogPath } from './config'

const LAUNCHER_API_URL = `${SUPABASE_FUNCTIONS_URL}/launcher-api`

interface BugReportPayload {
  playerId: string
  title: string
  description: string
  playerLog?: string
  systemInfo?: Record<string, string>
  gameVersion?: string
}

interface CrashReportPayload {
  playerId: string
  exitCode: number
  playerLog?: string
  systemInfo?: Record<string, string>
  gameVersion?: string
}

async function getPlayerLog(): Promise<string> {
  try {
    const fullLog = await fsp.readFile(getUnityLogPath(), 'utf-8')
    const lines = fullLog.split('\n')
    return lines.slice(-200).join('\n')
  } catch {
    return 'Could not read Player.log'
  }
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
    }

    await got.post(`${LAUNCHER_API_URL}/api/bug-reports`, {
      json: payload,
      responseType: 'json'
    })

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

    await got.post(`${LAUNCHER_API_URL}/api/crash-reports`, {
      json: payload,
      responseType: 'json'
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
