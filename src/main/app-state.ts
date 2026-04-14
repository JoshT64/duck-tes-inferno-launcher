/** Shared app-level state flags */

let quitting = false
let gameDownloading = false

export function isQuitting(): boolean { return quitting }
export function setQuitting(): void { quitting = true }

export function isGameDownloading(): boolean { return gameDownloading }
export function setGameDownloading(value: boolean): void { gameDownloading = value }
