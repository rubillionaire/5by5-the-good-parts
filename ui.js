const choo = require('choo')
const html = require('choo/html')
const raw = require('choo/html/raw')
const Component = require('choo/component')

const app = choo({ cache: 2000 })
app.use(showStore)
app.route('/', mainView)
app.route('/5by5-archive', mainView)
app.route('/5by5-archive/', mainView)
app.mount('#app')

function showStore (state, emitter) {
  state.playlist = {
    shows: [],
    channels: [],
    tick: 0
  }

  let frozenState = window.localStorage.getItem('state')
  if (frozenState) frozenState = JSON.parse(frozenState)
  fetch('shows.json').then((response) => {
    return response.json()
  })
    .then(function (feed) {
      const channelForName = (showName) => {
        for (var i = 0; i < feed.channels.length; i++) {
          if (feed.channels[i].file === showName) {
            return feed.channels[i]
          }
        }
      }
      state.playlist.shows = feed.shows.map((d) => {
        const { showName, episode } = showTitleEp(d)
        // prep show shape for show list
        d.id = showId({ showName, episode })
        d.channel = channelForName(showName)
        d.episode = episode
        // state of the show in the app
        if (frozenState && frozenState[d.id]) {
          d.lastPlayed = frozenState[d.id].lastPlayed
          d.drawerOpen = frozenState[d.id].drawerOpen
        }
        else {
          d.lastPlayed = undefined
          d.drawerOpen = false
        }
        d.playOnOpen = false
        return d
      })

      state.playlist.channels = feed.channels
        .map((channel) => {
          // default app state
          channel.displayInPlaylist = true
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
    })

  emitter.on('show:toggle-drawer', (showId) => {
    console.log('store:show:toggle-drawer', showId)
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].id === showId) {
        state.playlist.shows[i].drawerOpen = !state.playlist.shows[i].drawerOpen
        state.playlist.shows[i].playOnOpen = false
        break;
      }
    }
    render()
  })

  emitter.on('show:play-next', (showId) => {
    console.log('store:show:play-next')
    // close the existing 
    let nextShowIndex = null
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].id === showId) {
        state.playlist.shows[i].drawerOpen = false
        nextShowIndex = i + 1
      }
      if (i === nextShowIndex) {
        state.playlist.shows[i].drawerOpen = true
        state.playlist.shows[i].playOnOpen = true
      }
    }
    render()
  })

  emitter.on('show:set-last-played', (showId, lastPlayed) => {
    console.log('store:show:set-last-played', showId, lastPlayed)
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].id === showId) {
        state.playlist.shows[i].lastPlayed = lastPlayed
        break;
      }
    }
    render()
  })

  emitter.on('action-bar:scroll-to-latest', () => {
    console.log('store:action-bar:scroll-to-latest')
    let latestId;
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].lastPlayed) {
        latestId = state.playlist.shows[i].id
      }
    }
    if (latestId) {
      // scroll to latest
      let filterBarHeight =0
      const filterBarHeightString = document.body.style.getPropertyValue('--filter-bar-height')
      if (filterBarHeightString) {
        filterBarHeight = parseFloat(filterBarHeightString.slice(0,-2))
      }
      const scrollToBbox = document.getElementById(latestId).getBoundingClientRect()
      window.scrollTo(scrollToBbox.left, scrollToBbox.top + window.scrollY - filterBarHeight)
    }
  })

  emitter.on('filter-bar:toggle-channel', (toggleChannel) => {
    console.log('store:filter-bar:toggle-channel')
    console.log(toggleChannel)
    const channelsDisplayed = state.playlist.channels.filter((channel) => {
      return channel.displayInPlaylist
    })
    if (channelsDisplayed.length === state.playlist.channels.length) {
      // all shows are showing, isolate the one that
      // triggered this action
      state.playlist.channels = state.playlist.channels.map((channel) => {
        if (channel.showName === toggleChannel.showName) {
          channel.displayInPlaylist = true
        }
        else {
          channel.displayInPlaylist = false
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
        channel.displayInPlaylist = true
        return channel
      })
    }
    else {
      // no special case, just toggle the current channel
      state.playlist.channels = state.playlist.channels.map((channel) => {
        if (channel.showName === toggleChannel.showName) {
          channel.displayInPlaylist = !channel.displayInPlaylist
        }
        return channel
      })
    }
    return render()
  })

  function render () {
    state.playlist.tick += 1
    window.localStorage.setItem('state', JSON.stringify(freezeEpisodeState()))
    emitter.emit('render')
  }

  function freezeEpisodeState () {
    const frozen = {}
    for (let i = 0; i < state.playlist.shows.length; i++) {
      frozen[state.playlist.shows[i].id] = {
        lastPlayed: state.playlist.shows[i].lastPlayed,
        drawerOpen: state.playlist.shows[i].drawerOpen,
      }
    }
    return frozen
  }

  function showTitleEp (show) {
    const path = typeof show.guid[0] === 'string'
      ? show.guid[0].replace('http://5by5.tv/', '')
      : show.guid[0]._.replace('http://5by5.tv/', '')
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
    }
  }
  createElement (show) {
    console.log('show-item:create')
    this.show = show
    this.local.drawerOpen = this.show.drawerOpen
    this.local.lastPlayed = this.show.lastPlayed
    this.local.displayInPlaylist = this.displayInPlaylist.call(this)

    const displayClass = this.local.displayInPlaylist
      ? ''
      : 'visually-hidden'

    return html`
      <div
        class="show-item show-item-${this.show.channel.abbreviation} ${displayClass}"
        id=${this.show.id}>
        <hgroup class="show-item-header">
          <header class="show-item-image" style="background-image:url('${this.show['itunes:image'][0].$.href}')"></header>
          <header class="show-item-meta" onclick=${this.toggleDrawer.bind(this)}>
            <h3 class="show-item-name">${ this.show.channel.showName } - e${ this.show.episode }</h3>
            <h1 class="show-item-title">${ this.show.title[0] }</h1>
            <h4 class="show-item-timestamp">aired ${(new Date(this.show.pubDate[0]).toDateString())}</h4>
            <h4 class="show-item-timestamp ${classList({'visually-hidden': this.show.lastPlayed ? false : true})}">last played ${ this.show.lastPlayed ? this.show.lastPlayed : '' }</h4>
          </header>
        </hgroup>
        ${ this.show.drawerOpen ? this.markupDrawer.call(this) : '' }
      </div>
    `
  }
  displayInPlaylist () {
    const channels = this.state.playlist.channels.filter((channel) => {
      return channel.showName === this.show.channel.showName
    })
    if (channels.length !== 1) return false
    const channel = channels[0]
    this.show.channel.displayInPlaylist = channel.displayInPlaylist
    return this.show.channel.displayInPlaylist
  }
  markupDrawer () {
    console.log('drawer-markup')
    return html`
      <div class="show-item-drawer ${ classList({ 'drawer-open': this.show.drawerOpen}) }">
        <div class="show-item-player-container">
          ${this.show.playOnOpen
            ? this.markupAutoplayAudio.call(this)
            : this.markupDefaultAudio.call(this)}
        </div>
        <div class="show-item-notes">
          ${raw(this.show['content:encoded'][0])}
        </div>
        <div class="show-item-actions">
          <button
            class="show-item-button"
            onclick=${this.playNext.bind(this)}>play next in list</button>
        </div>
      </div>
    `
  }
  markupDefaultAudio () {
    return html`
      <audio controls 
        class="show-item-player"
        onended=${this.setLastPlayed.bind(this)}>
        <source
          src="${this.show.enclosure[0].$.url}"
          type="${this.show.enclosure[0].$.type}"
        />
      </audio>
    `
  }
  markupAutoplayAudio () {
    return html`
      <audio controls autoplay
        class="show-item-player"
        onended=${this.setLastPlayed.bind(this)}>
        <source
          src="${this.show.enclosure[0].$.url}"
          type="${this.show.enclosure[0].$.type}"
        />
      </audio>
    `
  }
  update (show) {
    console.log('show-item:update')
    this.show = show
    if (this.local.drawerOpen !== this.show.drawerOpen) {
      return true
    }
    if (this.local.lastPlayed !== this.show.lastPlayed) {
      return true
    }
    if (this.local.displayInPlaylist !== this.displayInPlaylist.call(this)) {
      return true
    }
    return false
  }
  playNext () {
    this.emit('show:play-next', this.show.id)
  }
  toggleDrawer () {
    this.emit('show:toggle-drawer', this.show.id)
  }
  setLastPlayed () {
    this.emit('show:set-last-played', this.show.id, (new Date()).toDateString())
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
            const colorClass = channel.displayInPlaylist
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
    for (var i = 0; i < this.state.playlist.channels.length; i++) {
      const selector = `button.filter-${this.state.playlist.channels[i].abbreviation}`
      const button = this.element.querySelector(selector)
      if (!button) return true
      if (this.state.playlist.channels[i].displayInPlaylist) {
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

class ActionBar extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
  }
  createElement () {
    return html`
      <div class="action-bar">
        <div class="action-bar-row">
          <button
            class="action-bar-button"
            onclick=${this.scrollToLatest.bind(this)}>latest</button>
        </div>
      </div>
    `
  }
  update () {
    return false
  }
  scrollToLatest () {
    this.emit('action-bar:scroll-to-latest')
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
