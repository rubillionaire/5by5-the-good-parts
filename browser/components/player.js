const debug = require('debug')('player')
const html = require('choo/html')
const Component = require('choo/component')
const classList = require('../utils/class-list')

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
    debug('create')
    if (this.local.show.id !== null &&
        this.local.show.id !== this.state.playlist.player.show.id) {
      const oldAudio = this.element.querySelector('audio')
      if (oldAudio) {
        oldAudio.pause()
        this.element.removeChild(oldAudio)
        this.local.startedPlaying = false
        debug('create:remove-old-audio')
      }
    }
    if (this.state.playlist.player.show.id !== null) {
      debug('guard-pass-new-show-id')
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
    debug('on-can-play')
    // implement auto play and set state on local component
    this.local.audio = this.element.querySelector('audio')
    this.local.audio.play()
      .then(() => {
        debug('on-can-play:playing')
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
        console.error(error)
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
    debug('on-ended')
    this.emit('player:set-last-played', this.local.show.id, (new Date()).toDateString())
  }
  onProgressInputChange () {
    debug('on-progress-input-change')
    const progress = this.element
      .querySelector('.player-controls-progress')
    this.local.audio.currentTime = progress.value
  }
  moveSeekBy (offset) {
    debug('move-seek-by')
    this.local.audio.currentTime = this.local.audio.currentTime + offset
  }
  update () {
    debug('update')
    if (this.local.show.id !== this.state.playlist.player.show.id) {
      return true
    }
    if (this.local.audio === null) {
      return true
    }
    return false
  }
  formatTime (seconds) {
    debug('format-time')
    let time = new Date(seconds * 1000).toISOString().substr(11, 8)
    if (time.startsWith('00:')) {
      time = time.slice(3)
    }
    return time
  }
}

const store = ({ saveShow }) => (state, emitter) => {
  emitter.on('player:set-last-played', (showId, lastPlayed) => {
    debug('store:set-last-played', showId, lastPlayed)
    for (var i = 0; i < state.playlist.shows.length; i++) {
      if (state.playlist.shows[i].id === showId) {
        state.playlist.shows[i].componentState.lastPlayed = lastPlayed
        saveShow(state.playlist.shows[i])
        break;
      }
    }
    emitter.emit('render:tick')
  })
}

module.exports = {
  component: Player,
  store,
}
