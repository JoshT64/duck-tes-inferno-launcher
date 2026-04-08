import { useElectronAPI } from '../hooks/useElectronAPI'

export default function TitleBar() {
  const api = useElectronAPI()

  return (
    <div className="title-bar">
      <span className="title-bar-label">Duck-te's Inferno</span>
      <div className="title-bar-controls">
        <button
          className="title-bar-btn"
          onClick={() => api.minimizeWindow()}
          aria-label="Minimize"
        >
          &#x2014;
        </button>
        <button
          className="title-bar-btn close"
          onClick={() => api.closeWindow()}
          aria-label="Close"
        >
          &#x2715;
        </button>
      </div>
    </div>
  )
}
