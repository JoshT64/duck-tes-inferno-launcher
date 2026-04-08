import { app } from 'electron'
import path from 'node:path'

// GitHub repos
export const RELEASES_OWNER = 'JoshT64'
export const RELEASES_REPO = 'duck-tes-inferno-releases'
export const RELEASES_API_URL = `https://api.github.com/repos/${RELEASES_OWNER}/${RELEASES_REPO}/releases/latest`

// Supabase
export const SUPABASE_URL = 'https://wyksiiqnmjxauhintiwi.supabase.co'
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`
export const LEADERBOARD_API_URL = `${SUPABASE_FUNCTIONS_URL}/leaderboard-api`

// Game paths (lazy — app.getPath() requires app.ready)
export const GAME_EXE_NAME = 'Duck-te-s-Inferno.exe'

export function getDefaultInstallPath(): string {
  return path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'DuckteInferno')
}

export function getUnityLogPath(): string {
  return path.join(
    app.getPath('appData'),
    '..',
    'LocalLow',
    'DucktesInferno',
    'Ducktes-Inferno',
    'Player.log'
  )
}

// Player config filename (written to game install dir, read by Unity)
export const PLAYER_CONFIG_FILENAME = 'player-config.json'
export const VERSION_FILENAME = 'current-version.json'
