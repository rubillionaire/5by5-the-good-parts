const debug = require('debug')('show-item')
const html = require('choo/html')
const Component = require('choo/component')
const raw = require('choo/html/raw')
const classList = require('../utils/class-list')

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
    debug('create')
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
    debug('drawer-markup')
    return html`
      <div class="show-item-drawer ${ classList({ 'drawer-open': this.show.componentState.drawerOpen}) }">
        <div class="show-item-notes">
          ${raw(this.show.description)}
        </div>
      </div>
    `
  }
  update (show) {
    debug('update')
    this.show = show
    if (this.local.drawerOpen !== this.show.componentState.drawerOpen) {
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

const store = ({ saveShow }) => (state, emitter) => {
  emitter.on('show:toggle-drawer', (showId) => {
    debug('store:toggle-drawer', showId)
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].id === showId) {
        state.playlist.shows[i].componentState.drawerOpen = !state.playlist.shows[i].componentState.drawerOpen
        saveShow(state.playlist.shows[i].componentState)
        state.playlist.shows[i].playOnOpen = false
        break;
      }
    }
    emitter.emit('render:tick')
  })

  emitter.on('show:play-show', (show) => {
    debug('store:play-show')
    state.playlist.player.show = show
    document.title = `${show.channel.showName} - e${show.episode} - ${show.title}`
    emitter.emit('render:tick')
  })
}

module.exports = {
  component: ShowItem,
  store,
}
