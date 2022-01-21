const debug = require('debug')('persistant')
const { Client: WebSocketClient } = require('rpc-websockets')

const serverDomain = process.env.SERVER_DOMAIN

const showKey = (show) => {
  return `show!${show.id}`
}
const channelKey = (channel) => {
  return `channel!${channel.showName}`
}
const internalKey = (property) => {
  return `internal!${property}`
}

const RemoteState = async () => {
  var ws = new WebSocketClient(`ws://${serverDomain}:8082`)

  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.once('error', reject)
    ws.once('close', reject)
  })

  const set = async ({ key, value }) => {
    return await ws.call('state-set', { key, value })
  }

  const get = async ({ timestamp }) => {
    try {
      const { result } = await ws.call('state-get', { timestamp }, 2000)
      return result
    } catch (error) {
      debug('remote-state:get:error')
      return null
    }
  }

  return {
    get,
    set,
  }
}

const LocalState = () => {
  const get = (key) => {
    const item = window.localStorage.getItem(key)
    if (typeof item !== 'string') return null
    try {
      return JSON.parse(item)
    } catch (error) {
      return item
    }
  }

  const set = ({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }

  return {
    get,
    set,
  }
}

async function PersistantStore () {
  let remoteState
  try {
    remoteState = await RemoteState()
  }
  catch (error) {
    debug('remote-store:initialize:error')
    console.error(error)
    remoteState = {
      async get () { return Promise.reject(null) },
      async set () { return Promise.reject(null) },
    }
  }

  const localState = LocalState()

  const internalSyncState = localState.get(internalKey('sync'))
  const syncTimestamp = internalSyncState && internalSyncState.timestamp
    ? internalSyncState.timestamp
    : null

  let initialRemoteState
  try {
    initialRemoteState = await remoteState.get({
      timestamp: syncTimestamp,
    })
  } catch (error) {
    initialRemoteState = {}
  }

  const get = (key) => {
    const local = localState.get(key)
    const remote = initialRemoteState[key]
    if (local && remote && local.timestamp > remote.timestamp) {
      return local
    }
    else if (local && remote && local.timestamp <= remote.timestamp) {
      return remote
    }
    else if (remote) {
      return remote
    }
    else if (local) {
      return local
    }
    else {
      return null
    }
  }

  const set = async ({ key, value }) => {
    const timestamp = Date.now()
    value.timestamp = timestamp
    localState.set({ key, value })
    window.localStorage.setItem(internalKey('sync'), JSON.stringify({ timestamp }))
    try {
      await remoteState.set({ key, value })
    } catch (error) {
      debug('set-remote:error')
      console.error(error)
    }
  }

  return {
    getShow (show) {
      const key = showKey(show)
      return get(key)
    },
    async saveShow (show) {
      const key = showKey(show)
      return set({ key, value: show })
    },
    getChannel (channel) {
      const key = channelKey(channel)
      return get(key)
    },
    async saveChannel (channel) {
      const key = channelKey(channel)
      return set({ key, value: channel })
    },
  }
}

module.exports = PersistantStore
