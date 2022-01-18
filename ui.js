const choo = require('choo')
const html = require('choo/html')
const raw = require('choo/html/raw')
const Component = require('choo/component')
const WebSocket = require('rpc-websockets').Client

const app = choo({ cache: 2000 })
app.use(showStore)
app.route('/', mainView)
app.route('/5by5-archive', mainView)
app.route('/5by5-archive/', mainView)
app.mount('#app')

const serverDomain = process.env.SERVER_DOMAIN

async function PersistState () {
  var ws = new WebSocket(`ws://${serverDomain}:8082`)

  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.once('error', reject)
    ws.once('close', reject)
  })

  const set = async ({ key, value }) => {
    ws.call('state-set', { key, value })
  }

  const get = async ({ timestamp }) => {
    try {
      const { result } = await ws.call('state-get', { timestamp }, 2000)
      return result
    } catch (error) {
      console.log('persist-pull:error')
      return {}
    }
  }

  ws.api = {
    get,
    set,
  }

  return ws
}

function localState (persist) {
  const showKey = (show) => {
    return `show!${show.id}`
  }
  const channelKey = (channel) => {
    return `channel!${channel.showName}`
  }
  const internalKey = (property) => {
    return `internal!${property}`
  }

  return {
    showKey,
    channelKey,
    getInternal,
    getShow,
    getChannel,
    saveShow,
    saveChannel,
  }

  function getAndParse (key) {
    const item = window.localStorage.getItem(key)
    if (typeof item !== 'string') return null
    try {
      return JSON.parse(item)
    } catch (error) {
      return item
    }
  }

  function getInternal (property) {
    return getAndParse(internalKey(property))
  }

  function getShow (show) {
    return getAndParse(showKey(show))
  }

  function getChannel (channel) {
    return getAndParse(channelKey(channel))
  }

  async function saveKeyValue (key, value) {
    const timestamp = Date.now()
    value.timestamp = timestamp
    window.localStorage.setItem(key, JSON.stringify(value))
    try {
      await persist.api.set({ key, value })
      window.localStorage.setItem(internalKey('sync'), JSON.stringify({ timestamp }))
    } catch (error) {
      console.log('save-key-value:error')
      console.log(error)
    }
  }

  function saveShow (show) {
    saveKeyValue(showKey(show), show.componentState)
  }

  function saveChannel (channel) {
    saveKeyValue(channelKey(channel), channel.componentState)
  }
}

async function showStore (state, emitter) {
  state.playlist = {
    shows: [],
    channels: [],
    tick: 0,
    player: {
      show: { id: null },
    },
  }

  let persist
  try {
    persist = await PersistState()
  } catch (error) {
    console.log('could not connect to WebSocketServer')
  }
  
  const local = localState(persist)

  let persisted = {}
  const internalSyncState = local.getInternal('sync')
  const syncTimestamp = internalSyncState && internalSyncState.timestamp
    ? internalSyncState.timestamp
    : null
  try {
    persisted = await persist.api.get({
      timestamp: syncTimestamp,
    })
  } catch (error) {
    console.log('persist-pull:error')
    console.log(error)
  }

  const response = await fetch('shows.json')
  const feed = await response.json()

  const channelForName = (showName) => {
    for (var i = 0; i < feed.channels.length; i++) {
      if (feed.channels[i].file === showName) {
        return feed.channels[i]
      }
    }
  }
  state.playlist.shows = feed.shows.map((show) => {
    const { showName, episode } = showTitleEp(show)
    // prep show shape for show list
    show.id = showId({ showName, episode })
    show.channel = channelForName(showName)
    show.episode = episode
    // state of the show in the app
    const localShowState = local.getShow(show)
    const persistedShowState = persisted[local.showKey(show)]
    if (localShowState && persistedShowState) {
      show.componentState = Object.assign(
        {},
        localShowState,
        persistedShowState
      )
    }
    else if (persistedShowState) {
      show.componentState = persistedShowState
    }
    else if (localShowState) {
      show.componentState = localShowState
    }
    else {
      show.componentState = {
        lastPlayed: null,
        drawerOpen: false,
      }
      local.saveShow(show)
    }
    show.playOnOpen = false
    return show
  })

  state.playlist.channels = feed.channels
    .map((channel) => {
      // default app state
      const localChannelState = local.getChannel(channel)
      const persistedChannelState = persisted[local.channelKey(channel)]
      if (localChannelState && persistedChannelState) {
        channel.componentState = Object.assign(
          {},
          localChannelState,
          persistedChannelState
        )
      }
      else if (localChannelState) {
        channel.componentState = localChannelState
      }
      else if (persistedChannelState) {
        channel.componentState = persistedChannelState
      }
      else {
        channel.componentState = {
          displayInPlaylist: true
        }
        local.saveChannel(channel)
      }
      return channel
    })
    .sort((a, b) => {
      if (a.showName > b.showName) {
        return 1
      }
      if (a.showName < b.showName) {
        return -1
      }
      return 0
    })

  render()

  emitter.on('show:toggle-drawer', (showId) => {
    console.log('store:show:toggle-drawer', showId)
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].id === showId) {
        state.playlist.shows[i].componentState.drawerOpen = !state.playlist.shows[i].componentState.drawerOpen
        local.saveShow(state.playlist.shows[i])
        state.playlist.shows[i].playOnOpen = false
        break;
      }
    }
    render()
  })

  emitter.on('player:set-last-played', (showId, lastPlayed) => {
    console.log('store:show:set-last-played', showId, lastPlayed)
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].id === showId) {
        state.playlist.shows[i].componentState.lastPlayed = lastPlayed
        local.saveShow(state.playlist.shows[i])
        break;
      }
    }
    render()
  })

  emitter.on('action-bar:scroll-to-latest', () => {
    console.log('store:action-bar:scroll-to-latest')
    let latestId;
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].componentState.lastPlayed) {
        latestId = state.playlist.shows[i].id
      }
    }
    if (latestId) {
      // scroll to latest
      const filterBarHeight = getFilterBarHeight()
      const scrollToBbox = document.getElementById(latestId).getBoundingClientRect()
      window.scrollTo(scrollToBbox.left, scrollToBbox.top + window.scrollY - filterBarHeight)
    }
  })

  emitter.on('action-bar:scroll-to-playing', () => {
    console.log('store:action-bar:scroll-to-playing')
    const playingId = state.playlist.player.show.id
    const filterBarHeight = getFilterBarHeight()
    const scrollToBbox = document.getElementById(playingId).getBoundingClientRect()
    window.scrollTo(scrollToBbox.left, scrollToBbox.top + window.scrollY - filterBarHeight)
  })

  function getFilterBarHeight () {
    let filterBarHeight = 0
    const filterBarHeightString = document.body.style.getPropertyValue('--filter-bar-height')
    if (filterBarHeightString) {
      filterBarHeight = parseFloat(filterBarHeightString.slice(0,-2))
    }
    return filterBarHeight
  }

  emitter.on('filter-bar:toggle-channel', (toggleChannel) => {
    console.log('store:filter-bar:toggle-channel')
    console.log(toggleChannel)
    const channelsDisplayed = state.playlist.channels.filter((channel) => {
      return channel.componentState.displayInPlaylist
    })
    if (channelsDisplayed.length === state.playlist.channels.length) {
      // all shows are showing, isolate the one that
      // triggered this action
      state.playlist.channels = state.playlist.channels.map((channel) => {
        if (channel.showName === toggleChannel.showName) {
          channel.componentState.displayInPlaylist = true
        }
        else {
          channel.componentState.displayInPlaylist = false
        }
        return channel
      })
    }
    else if (
      channelsDisplayed.length === 1 &&
      channelsDisplayed[0].showName === toggleChannel.showName
      ) {
      // the only displayed channel was selected
      // set all channels to be displayed
      state.playlist.channels = state.playlist.channels.map((channel) => {
        channel.componentState.displayInPlaylist = true
        return channel
      })
    }
    else {
      // no special case, just toggle the current channel
      state.playlist.channels = state.playlist.channels.map((channel) => {
        if (channel.showName === toggleChannel.showName) {
          channel.componentState.displayInPlaylist = !channel.componentState.displayInPlaylist
        }
        return channel
      })
    }
    state.playlist.channels.forEach((channel) => local.saveChannel(channel))
    return render()
  })

  emitter.on('show:play-show', (show) => {
    console.log('show:play-show')
    state.playlist.player.show = show
    document.title = `${show.channel.showName} - e${show.episode} - ${show.title}`
    render()
  })

  function render () {
    state.playlist.tick += 1
    emitter.emit('render')
  }

  function showTitleEp (show) {
    const path = show.guid.replace('http://5by5.tv/', '')
    let [ showName, episode ] = path.split('/')
    episode = episode.split('-')[0]
    return { showName, episode }
  }
  function showId ({ showName, episode }) {
    return `${showName}-${episode}`
  }
}

class ShowItem extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
    this.show;
    this.local = this.state.components[name] = {
      drawerOpen: false,
      lastPlayed: undefined,
      displayInPlaylist: true,
      currentlyPlaying: false,
    }
  }
  createElement (show) {
    console.log('show-item:create')
    this.show = show
    this.local.drawerOpen = this.show.componentState.drawerOpen
    this.local.lastPlayed = this.show.componentState.lastPlayed
    this.local.displayInPlaylist = this.displayInPlaylist.call(this)
    this.local.currentlyPlaying = this.state.playlist.player.show.id === this.show.id
    
    const extraClasses = classList({
      'visually-hidden': !this.local.displayInPlaylist,
      'currently-playing': this.local.currentlyPlaying
    })

    return html`
      <div
        class="show-item show-item-${this.show.channel.abbreviation} ${extraClasses}"
        id=${this.show.id}>
        <hgroup class="show-item-header" onclick=${this.playShow.bind(this)}>
          <header class="show-item-mark">
            <h1 class="show-item-mark-text">${this.show.channel.abbreviation}</h1>
          </header>
          <header class="show-item-meta">
            <h3 class="show-item-name">${this.show.channel.showName} - e${ this.show.episode }</h3>
            <h1 class="show-item-title">${this.show.title}</h1>
            <h4 class="show-item-timestamp">aired ${(new Date(this.show.pubDate).toDateString())}</h4>
            <h4 class="show-item-timestamp ${classList({'visually-hidden': this.show.componentState.lastPlayed ? false : true})}">last played ${ this.show.componentState.lastPlayed ? this.show.componentState.lastPlayed : '' }</h4>
          </header>
          <header class="show-item-actions">
            <button
              class="show-item-toggle-drawer ${classList({'animate-open': this.local.drawerOpen})}"
              onclick=${this.toggleDrawer.bind(this)}>❋</button>
          </header>
        </hgroup>
        ${ this.show.componentState.drawerOpen ? this.markupDrawer.call(this) : '' }
      </div>
    `
  }
  displayInPlaylist () {
    const channels = this.state.playlist.channels.filter((channel) => {
      return channel.showName === this.show.channel.showName
    })
    if (channels.length !== 1) return false
    const channel = channels[0]
    this.show.channel.componentState.displayInPlaylist = channel.componentState.displayInPlaylist
    return this.show.channel.componentState.displayInPlaylist
  }
  markupDrawer () {
    console.log('drawer-markup')
    return html`
      <div class="show-item-drawer ${ classList({ 'drawer-open': this.show.componentState.drawerOpen}) }">
        <div class="show-item-notes">
          ${raw(this.show.description)}
        </div>
      </div>
    `
  }
  update (show) {
    console.log('show-item:update')
    this.show = show
    if (this.local.drawerOpen) console.log('uhh')
    if (this.local.drawerOpen !== this.show.componentState.drawerOpen) {
      console.log('show-item:update:drawer-open')
      return true
    }
    if (this.local.lastPlayed !== this.show.componentState.lastPlayed) {
      return true
    }
    if (this.local.displayInPlaylist !== this.displayInPlaylist.call(this)) {
      return true
    }
    if (this.local.currentlyPlaying === false &&
        this.show.id === this.state.playlist.player.show.id) {
      return true
    }
    if (this.local.currentlyPlaying === true &&
        this.show.id !== this.state.playlist.player.show.id) {
      return true
    }
    return false
  }
  toggleDrawer (event) {
    event.stopPropagation()
    this.emit('show:toggle-drawer', this.show.id)
  }
  playShow () {
    this.emit('show:play-show', this.show)
  }
}

class ShowList extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
    this.local = this.state.components[name] = {
      shows: [],
      tick: 0,
    }
  }
  createElement () {
    console.log('show-list:create')
    this.local.shows = this.state.playlist.shows
    this.local.tick = this.state.playlist.tick

    return html`
      <div class="show-list">
        
        ${this.state.playlist.shows.map((show, id) => {
          return html`
            <li class="show-list-item">
              ${this.state.cache(ShowItem, `show-list-${id}`).render(show)}
            </li>
          `
        })}
             
      </div>
    `
  }
  update () {
    console.log('show-list:update')
    if (this.local.shows.length !== this.state.playlist.shows.length) {
      return true
    }
    if (this.local.tick !== this.state.playlist.tick) {
      return true
    }
    console.log('show-list:update:no-update')
    return false
  }
}

class FilterBar extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
  }
  createElement () {
    console.log('filter-bar:create')
    return html`
      <div class="filter-bar">
        <div class="filter-bar-row">
          ${this.state.playlist.channels.map((channel) => {
            const colorClass = channel.componentState.displayInPlaylist
              ? ''
              : 'filter-bar-button-muted'
            return html`
              <button
                class="filter-bar-button filter-${channel.abbreviation} ${colorClass}"
                onclick=${this.filterShowList.bind(this, channel)}>${channel.abbreviation}</button>
            `
          })}
        </div>
      </div>
    `
  }
  load () {
    console.log('filter-bar:set-height')

    const bbox = this.element.getBoundingClientRect()
    if (bbox.height < 40) {
      // bbox should be at least 40px, this is the height of
      // a button that is the element. queue another attempt
      // in 100ms to see if the button has been rendered
      return setTimeout(this.load.bind(this), 100)
    }

    document.body.style.setProperty('--filter-bar-height', `${bbox.height}px`)  
  }
  update () {
    console.log('filter-bar:update')
    for (var i = 0; i < this.state.playlist.channels.length; i++) {
      const selector = `button.filter-${this.state.playlist.channels[i].abbreviation}`
      const button = this.element.querySelector(selector)
      if (!button) return true
      if (this.state.playlist.channels[i].componentState.displayInPlaylist) {
        button.classList.remove('filter-bar-button-muted')
      }
      else {
        button.classList.add('filter-bar-button-muted')
      }
    }
    return false
  }
  filterShowList (channel) {
    this.emit('filter-bar:toggle-channel', channel)
  }
}

class Player extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
    this.local = this.state.components[name] = {
      show: {
        id: null,
        media: {
          url: null,
          type: null,
        },
      },
      audio: null, // managed within this component
      startedPlaying: false,
    }
  }
  createElement () {
    console.log('player:create')
    if (this.local.show.id !== null &&
        this.local.show.id !== this.state.playlist.player.show.id) {
      const oldAudio = this.element.querySelector('audio')
      if (oldAudio) {
        oldAudio.pause()
        this.element.removeChild(oldAudio)
        this.local.startedPlaying = false
        console.log('player:create:remove-old-audio')
      }
    }
    if (this.state.playlist.player.show.id !== null) {
      console.log('player:guard-pass-new-show-id')
      this.local.show = this.state.playlist.player.show  
    }
    return html`
      <div class="action-bar-drawer">
        ${this.local.show.id !== null
            ? html`
              <audio
                class="action-bar-player"
                oncanplay=${this.onCanPlay.bind(this)}
                onprogress=${this.onProgress.bind(this)}
                onended=${this.onEnded.bind(this)}>
                <source
                  src="${this.local.show.media.url}"
                  type="${this.local.show.media.type}"
                /></audio>`
              : ''}
        <div class="action-bar-player-controls ${classList({'action-control-disabled': this.local.show.id === null})}">
          <div class="action-bar-player-controls-row">
            <div class="player-controls-progress-container">
              <input
                type="range"
                min="0"
                max="100"
                value="0"
                step="1"
                class="player-controls-progress"
                oninput=${this.onProgressInputChange.bind(this)}
              />
              <span class="player-controls-duration">${this.local.audio ? this.formatTime(this.local.audio.duration) : '0:00'}</span>
            </div>
          </div>
          <div class="action-bar-player-controls-row">
            <button
              class="player-controls-minus-30"
              onclick=${this.moveSeekBy.bind(this, -30)}>-30s</button>
            <button
              class="player-controls-plus-30"
              onclick=${this.moveSeekBy.bind(this, 30)}>+30s</button>
          </div>
        </div>
      </div>
    `
  }
  onCanPlay () {
    if (this.local.startedPlaying === true) return
    console.log('player:on-can-play')
    // implement auto play and set state on local component
    this.local.audio = this.element.querySelector('audio')
    this.local.audio.play()
      .then(() => {
        console.log('player:on-can-play:playing')
        this.local.startedPlaying = true
        document
          .querySelector('.action-bar-button-play-pause')
          .innerText = this.local.audio.paused
            ? '▶'
            : 'll'
        document
          .querySelector('.player-controls-duration')
          .innerText = this.formatTime(this.local.audio.duration)
      })
      .catch((error) => {
        console.log(error)
      })
    // local mutation
    const progress = this.element
      .querySelector('.player-controls-progress')
    progress.value = 0
    progress.max = this.local.audio.duration
  }
  onProgress () {
    if (this.local.audio === null) return
    const progress = this.element
      .querySelector('.player-controls-progress')
    progress.value = this.local.audio.currentTime
  }
  onEnded () {
    console.log('player:on-ended')
    this.emit('player:set-last-played', this.local.show.id, (new Date()).toDateString())
  }
  onProgressInputChange () {
    console.log('player:on-progress-input-change')
    const progress = this.element
      .querySelector('.player-controls-progress')
    this.local.audio.currentTime = progress.value
  }
  moveSeekBy (offset) {
    console.log('player:move-seek-by')
    this.local.audio.currentTime = this.local.audio.currentTime + offset
  }
  update () {
    console.log('player:update')
    if (this.local.show.id !== this.state.playlist.player.show.id) {
      return true
    }
    if (this.local.audio === null) {
      return true
    }
    return false
  }
  formatTime (seconds) {
    console.log('player:format-time')
    let time = new Date(seconds * 1000).toISOString().substr(11, 8)
    if (time.startsWith('00:')) {
      time = time.slice(3)
    }
    return time
  }
}

class ActionBar extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
    this.local = this.state.components[name] = {
      hasALastPlayed: false,
      drawerOpen: false,
    }
  }
  createElement () {
    console.log('action-bar:create')
    if (this.local.hasALastPlayed === false) {
      this.local.hasALastPlayed = this.hasALastPlayed()
    }
    return html`
      <div class="action-bar ${classList({
          'action-bar-drawer-hidden': !this.local.drawerOpen,
        })}">
        <div class="action-bar-row">
          <div class="action-bar-buttons">
            <button
              class="action-bar-button-play-pause ${classList({'action-button-disabled': this.state.playlist.player.show.id === null})}"
              onclick=${this.onPlayPause.bind(this)}>▶</button>
            <button
              class="action-bar-button-scroll-to-playing ${classList({'action-button-disabled': this.state.playlist.player.show.id === null})}"
              onclick=${this.scrollToPlaying.bind(this)}
            >playing</button>
            <button
              class="action-bar-button-scroll-to-latest ${classList({'action-button-disabled': this.local.hasALastPlayed === false})}"
              onclick=${this.scrollToLatest.bind(this)}
            >last</button>
            <button
              class="action-bar-button-toggle-drawer"
              onclick=${this.toggleDrawer.bind(this)}
            >❋</button>
          </div>
          ${this.state.cache(Player, 'player').render()}
        </div>
      </div>
    `
  }
  hasALastPlayed () {
    const hasBeenPlayed = this.state.playlist.shows.filter((show) => {
      return show.componentState.lastPlayed !== null
    })
    return hasBeenPlayed.length > 0
  }
  load () {
    console.log('action-bar:load')
    this.setDrawerHeight()
  }
  update () {
    console.log('action-bar:update')
    if (this.local.hasALastPlayed === false && this.hasALastPlayed()) {
      this.local.hasALastPlayed = true
      return true
    }
    // allow update to handle player component
    if (this.state.components.player.show.id !== this.state.playlist.player.show.id) {
      return true
    }
    return false
  }
  scrollToLatest () {
    this.emit('action-bar:scroll-to-latest')
  }
  scrollToPlaying () {
    console.log('action-bar:scroll-to-playing')
    this.emit('action-bar:scroll-to-playing')
  }
  onPlayPause () {
    console.log('action-bar:on-play-pause')
    this.state.components.player.audio[
      this.state.components.player.audio.paused
        ? 'play'
        : 'pause']()
    this.element
      .querySelector('.action-bar-button-play-pause')
      .innerText = this.state.components.player.audio.paused
        ? '▶'
        : 'll'
  }
  setDrawerHeight () {
    const drawer = this.element.querySelector('.action-bar-drawer')
    const bbox = drawer.getBoundingClientRect()
    const height = bbox.height
    console.log('action-bar:set-drawer-height', height)
    document.documentElement.style.setProperty('--action-bar-drawer-height', `${bbox.height}px`)
    return height
  }
  toggleDrawer () {
    this.local.drawerOpen = !this.local.drawerOpen
    this.element.classList.toggle('action-bar-drawer-hidden')
  }
}

function mainView (state, emit) {
  console.log('main view')
  return html`
    <div id="app">
      ${state.cache(FilterBar, 'filter-bar').render()}
      ${state.cache(ShowList, 'show-list').render()}
      ${state.cache(ActionBar, 'action-bar').render()}
    </div>
  `
}

function classList (classes) {
  var str = ''
  var keys = Object.keys(classes)
  for (var i = 0, len = keys.length; i < len; i++) {
    var key = keys[i]
    var val = classes[key]
    if (val) str += (key + ' ')
  }
  return str
}
