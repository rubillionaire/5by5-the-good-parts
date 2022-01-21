const debug = require('debug')('action-bar')
const html = require('choo/html')
const Component = require('choo/component')
const { component: Player } = require('./player.js')
const classList = require('../utils/class-list')

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
    debug('create')
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
    debug('load')
    this.setDrawerHeight()
  }
  update () {
    debug('update')
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
    debug('scroll-to-playing')
    this.emit('action-bar:scroll-to-playing')
  }
  onPlayPause () {
    debug('on-play-pause')
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
    debug('set-drawer-height', height)
    document.documentElement.style.setProperty('--action-bar-drawer-height', `${bbox.height}px`)
    return height
  }
  toggleDrawer () {
    this.local.drawerOpen = !this.local.drawerOpen
    this.element.classList.toggle('action-bar-drawer-hidden')
  }
}

const store = (state, emitter) => {
  emitter.on('action-bar:scroll-to-latest', () => {
    debug('store:scroll-to-latest')
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
    debug('store:scroll-to-playing')
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
}

module.exports = {
  component: ActionBar,
  store,
}
