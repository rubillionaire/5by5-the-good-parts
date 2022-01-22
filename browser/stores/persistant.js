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
  debug('remote-state:initialize')
  var ws = new WebSocketClient(`ws://${serverDomain}:8082`)

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

  const notConnceted = (intended) => () => {
    return Promise.resolve(`${intended} could not be completed.
      no websocket connection to the server.`)
  }

  const api = await new Promise((resolve, reject) => {
    ws.on('open', () => {
      debug('remote-state:open')
      resolve({ set, get })
    })
    ws.once('error', (error) => {
      debug('remote-state:error')
      console.error(error)
      resolve({
        set: notConnceted('set'),
        get: notConnceted('get'),
      })
    })
  })

  return api
}

const LocalState = () => {
  debug('local-state:initialize')
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
  const remoteState = await RemoteState()
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
