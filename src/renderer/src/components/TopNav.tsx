import { ReactElement } from 'react'

interface TopNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  displayName: string
  onSettingsClick: () => void
}

const tabs = [
  { id: 'home', label: 'News' },
  { id: 'changelog', label: 'Changelog' },
  { id: 'report', label: 'Report Bug' }
]

export default function TopNav({
  activeTab,
  onTabChange,
  displayName,
  onSettingsClick
}: TopNavProps): ReactElement {
  return (
    <nav className="top-nav">
      <div className="nav-left">
        <span className="nav-logo">&#x1F986;</span>
        <span className="nav-title">DUCKTE&apos;S INFERNO</span>
      </div>
      <div className="nav-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="nav-right">
        <span className="nav-username">{displayName}</span>
        <button className="nav-settings" onClick={onSettingsClick}>
          &#x2699;
        </button>
      </div>
    </nav>
  )
}
