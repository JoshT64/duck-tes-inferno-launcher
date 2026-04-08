import { BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import store from './store'
import { GAME_EXE_NAME, getUnityLogPath, PLAYER_CONFIG_FILENAME } from './config'

let gameProcess: ChildProcess | null = null

export function isGameRunning(): boolean {
  return gameProcess !== null && gameProcess.exitCode === null
}

export async function writePlayerConfig(): Promise<void> {
  const installPath = store.get('installPath')
  const configPath = path.join(installPath, 'DuckteInferno', PLAYER_CONFIG_FILENAME)

  const config = {
    playerId: store.get('playerId'),
    displayName: store.get('displayName')
  }

  await fsp.writeFile(configPath, JSON.stringify(config, null, 2))
}

export async function launchGame(mainWindow: BrowserWindow): Promise<void> {
  if (isGameRunning()) {
    throw new Error('Game is already running')
  }

  const installPath = store.get('installPath')
  const exePath = path.join(installPath, 'DuckteInferno', 'game', GAME_EXE_NAME)

  if (!fs.existsSync(exePath)) {
    throw new Error(`Game executable not found at ${exePath}`)
  }

  await writePlayerConfig()

  gameProcess = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    detached: false,
    stdio: 'ignore'
  })

  mainWindow.webContents.send('game-state', 'running')

  gameProcess.on('exit', async (code, _signal) => {
    gameProcess = null
    mainWindow.webContents.send('game-state', 'stopped')

    if (code !== null && code !== 0) {
      const crashData = await collectCrashData(code)
      mainWindow.webContents.send('game-crashed', crashData)
    }
  })

  gameProcess.on('error', (err) => {
    gameProcess = null
    mainWindow.webContents.send('game-state', 'stopped')
    mainWindow.webContents.send('game-error', err.message)
  })
}

interface CrashData {
  exitCode: number
  playerLog: string
  systemInfo: SystemInfo
  gameVersion: string
}

interface SystemInfo {
  os: string
  osVersion: string
  arch: string
  totalMemory: string
  freeMemory: string
}

async function collectCrashData(exitCode: number): Promise<CrashData> {
  let playerLog = ''
  try {
    const fullLog = await fsp.readFile(getUnityLogPath(), 'utf-8')
    const lines = fullLog.split('\n')
    playerLog = lines.slice(-200).join('\n')
  } catch {
    playerLog = 'Could not read Player.log'
  }

  const systemInfo: SystemInfo = {
    os: os.platform(),
    osVersion: os.release(),
    arch: os.arch(),
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`
  }

  return {
    exitCode,
    playerLog,
    systemInfo,
    gameVersion: store.get('gameVersion') || 'unknown'
  }
}
