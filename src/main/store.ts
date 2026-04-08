import Store from 'electron-store'

interface StoreSchema {
  playerId: string
  displayName: string
  installPath: string
  autoUpdate: boolean
  gameVersion: string
}

const store = new Store<StoreSchema>({
  schema: {
    playerId: { type: 'string', default: '' },
    displayName: { type: 'string', default: '' },
    installPath: { type: 'string', default: '' },
    autoUpdate: { type: 'boolean', default: true },
    gameVersion: { type: 'string', default: '' }
  }
})

export default store
