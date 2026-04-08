import type { GameState } from '../types'

interface PlayButtonProps {
  gameState: GameState
  updatePercent: number
  gameVersion: string
  onPlay: () => void
}

export default function PlayButton({ gameState, updatePercent, gameVersion, onPlay }: PlayButtonProps) {
  const isDisabled = gameState === 'updating' || gameState === 'running'

  function getLabel(): string {
    switch (gameState) {
      case 'running': return 'RUNNING'
      case 'updating': return `UPDATING ${updatePercent}%`
      case 'installing': return 'INSTALL'
      default: return 'PLAY'
    }
  }

  return (
    <div className="play-section">
      <button className="play-button" disabled={isDisabled} onClick={onPlay}>{getLabel()}</button>
      {gameVersion && <span className="version-label">{gameVersion}</span>}
    </div>
  )
}
