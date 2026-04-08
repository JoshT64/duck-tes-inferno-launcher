import type { Release } from '../types'

interface NewsCardProps { release: Release; onClick?: () => void }

function stripMarkdown(text: string): string {
  return text.replace(/#{1,6}\s*/g, '').replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

export default function NewsCard({ release, onClick }: NewsCardProps) {
  const date = new Date(release.published_at).toLocaleDateString()
  const stripped = stripMarkdown(release.body)
  const snippet = stripped.length > 100 ? stripped.substring(0, 100) + '...' : stripped

  return (
    <div className="news-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="news-card-header">
        <span className="news-card-version">{release.tag_name}</span>
        <span className="news-card-date">{date}</span>
      </div>
      <h3 className="news-card-title">{release.name}</h3>
      <p className="news-card-snippet">{snippet}</p>
    </div>
  )
}
