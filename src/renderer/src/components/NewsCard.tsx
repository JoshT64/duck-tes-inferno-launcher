import type { Release } from '../types'

interface NewsCardProps { release: Release }

export default function NewsCard({ release }: NewsCardProps) {
  const date = new Date(release.published_at).toLocaleDateString()
  const snippet = release.body.length > 100 ? release.body.substring(0, 100) + '...' : release.body

  return (
    <div className="news-card">
      <div className="news-card-header">
        <span className="news-card-version">{release.tag_name}</span>
        <span className="news-card-date">{date}</span>
      </div>
      <h3 className="news-card-title">{release.name}</h3>
      <p className="news-card-snippet">{snippet}</p>
    </div>
  )
}
