const choo = require('choo')
const html = require('choo/html')
const raw = require('choo/html/raw')
const Component = require('choo/component')

const app = choo()
app.use(showStore)
app.route('/', mainView)
app.route('/5by5-archive', mainView)
app.route('/5by5-archive/', mainView)
app.mount('#app')

function showStore (state, emitter) {
  state.shows = {
    episodes: [],
    channels: [],
  }

  let frozenState = window.localStorage.getItem('state')
  if (frozenState) frozenState = JSON.parse(frozenState)
  fetch('shows.json').then((feed) => {
    return feed.json()
  })
    .then(function (episodes) {
      state.shows.episodes = episodes.map((d) => {
        // prep show shape for show list
        d.id = showId(showTitleEp(d))
        d.showName = showTitleEp(d).showName
        d.episode = showTitleEp(d).episode
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

      state.shows.channels = episodes.map((d) => {
          return {
            showName: showTitleEp(d).showName,
            image: d['itunes:image'][0].$.href,
          }
        })
        .filter(uniqueArray(compareChannelNames))
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

  // are two channels the same?
  function compareChannelNames (a, b) {
    return a.showName === b.showName
  }
  function uniqueArray (comparator) {
    const unique = []
    return function (checkUniqueValue, index) {
      const valuesIncluded = unique.filter(function (uniqueValue) {
        return comparator(uniqueValue, checkUniqueValue)
      })
      if (valuesIncluded.length === 0) {
        // value does not exist in unique, allow it to
        // pass through
        unique.push(checkUniqueValue)
        return true
      }
      else {
        // value is already included
        return false
      }
    }
  }

  emitter.on('show:toggle-drawer', (showId) => {
    console.log('store:show:toggle-drawer', showId)
    for (var i = 0; i < state.shows.episodes.length; i++) {
      if (state.shows.episodes[i].id === showId) {
        state.shows.episodes[i].drawerOpen = !state.shows.episodes[i].drawerOpen
        state.shows.episodes[i].playOnOpen = false
        break;
      }
    }
    render()
  })

  emitter.on('show:play-next', (showId) => {
    console.log('store:show:play-next')
    // close the existing 
    let nextShowIndex = null
    for (var i = 0; i < state.shows.episodes.length; i++) {
      if (state.shows.episodes[i].id === showId) {
        state.shows.episodes[i].drawerOpen = false
        nextShowIndex = i + 1
      }
      if (i === nextShowIndex) {
        state.shows.episodes[i].drawerOpen = true
        state.shows.episodes[i].playOnOpen = true
      }
    }
    render()
  })

  emitter.on('show:set-last-played', (showId, lastPlayed) => {
    console.log('store:show:set-last-played', showId, lastPlayed)
    for (var i = 0; i < state.shows.episodes.length; i++) {
      if (state.shows.episodes[i].id === showId) {
        state.shows.episodes[i].lastPlayed = lastPlayed
        break;
      }
    }
    render()
  })

  emitter.on('action-bar:scroll-to-latest', () => {
    console.log('store:action-bar:scroll-to-latest')
    let latestId;
    for (var i = 0; i < state.shows.episodes.length; i++) {
      if (state.shows.episodes[i].lastPlayed) {
        latestId = state.shows.episodes[i].id
      }
    }
    if (latestId) {
      document.getElementById(latestId).scrollIntoView(true)
    }
  })

  emitter.on('filter-bar:toggle-channel', (channel) => {
    console.log('filter-bar:toggle-channel')
    console.log(channel)
  })

  function render () {
    window.localStorage.setItem('state', JSON.stringify(freezeEpisodeState()))
    emitter.emit('render')
  }

  function freezeEpisodeState () {
    const frozen = {}
    for (let i = 0; i < state.shows.episodes.length; i++) {
      frozen[state.shows.episodes[i].id] = {
        lastPlayed: state.shows.episodes[i].lastPlayed,
        drawerOpen: state.shows.episodes[i].drawerOpen,
      }
    }
    return frozen
  }

  function showTitleEp (show) {
    const path = typeof show.guid[0] === 'string'
      ? show.guid[0].replace('http://5by5.tv/', '')
      : show.guid[0]._.replace('http://5by5.tv/', '')
    const [ showName, episode ] = path.split('/')
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
    }
  }
  createElement (show) {
    console.log('show-item:create')
    this.show = show

    return html`
      <div class="show-item" id=${this.show.id}>
        <hgroup class="show-item-header">
          <header class="show-item-image" style="background-image:url('${this.show['itunes:image'][0].$.href}')"></header>
          <header class="show-item-meta" onclick=${this.toggleDrawer.bind(this)}>
            <h3 class="show-item-name">${ this.show.showName } - e${ this.show.episode }</h3>
            <h1 class="show-item-title">${ this.showTitle(this.show) }</h1>
            <h4 class="show-item-timestamp">aired ${(new Date(this.show.pubDate[0]).toDateString())}</h4>
            <h4 class="show-item-timestamp ${classList({'visually-hidden': this.show.lastPlayed ? false : true})}">last played ${ this.show.lastPlayed ? this.show.lastPlayed : '' }</h4>
          </header>
        </hgroup>
        ${ this.show.drawerOpen ? this.markupDrawer.call(this) : '' }
      </div>
    `
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
  playNext () {
    this.emit('show:play-next', this.show.id)
  }
  toggleDrawer () {
    this.emit('show:toggle-drawer', this.show.id)
  }
  setLastPlayed () {
    this.emit('show:set-last-played', this.show.id, (new Date()).toDateString())
  }
  update (show) {
    console.log('show-item:update')
    this.show = show
    if (this.local.drawerOpen !== this.show.drawerOpen) {
      this.local.drawerOpen = this.show.drawerOpen
      return true
    }
    if (this.local.lastPlayed !== this.show.lastPlayed) {
      this.local.lastPlayed = this.show.lastPlayed
      return true
    }
    return false
  }
  showTitle (show) {
    return show.title[0].split(':').slice(1).join(':')
  }
}

class ShowList extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
    this.local = this.state.components[name] = {
      episodes: []
    }
  }
  createElement () {
    console.log('show-list:create')
    this.local.episodes = this.state.shows.episodes
    return html`
      <div class="show-list">
        
        ${this.state.shows.episodes.map((show, id) => {
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
    if (this.local.episodes.length !== this.state.shows.episodes.length) {
      this.local.episodes = this.state.shows.episodes
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
    this.local = {
      channels: []
    }
    this.buttonTextMap = {
      'afterdark': 'ad',
      'b2w': 'bw',
      'buildanalyze': 'ba',
      'hypercritical': 'hc',
      'talkshow': 'ts',
    }
  }
  createElement () {
    this.local.channels = this.state.shows.channels
    return html`
      <div class="filter-bar">
        <div class="filter-bar-row">
          ${this.state.shows.channels.map((channel) => {
            let text = this.buttonTextMap[channel.showName]
            if (!text) text = channel.showName
            return html`
              <button
                class="filter-bar-button"
                onclick=${this.filterShowList.bind(this, channel)}>${text}</button>
            `
          })}
        </div>
      </div>
    `
  }
  update () {
    if (this.local.channels.length !== this.state.shows.channels.length) {
      this.local.channels = this.state.shows.channels
      return true
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
