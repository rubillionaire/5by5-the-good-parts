const debug = require('debug')('filter-bar')
const html = require('choo/html')
const Component = require('choo/component')

class FilterBar extends Component {
  constructor (name, state, emit) {
    super(name)
    this.state = state
    this.emit = emit
  }
  createElement () {
    debug('create')
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
    debug('set-height')
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
    debug('update')
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

const store = ({ saveChannel }) => (state, emitter) => {
  emitter.on('filter-bar:toggle-channel', (toggleChannel) => {
    debug('store:toggle-channel')
    debug(toggleChannel)
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
    state.playlist.channels.forEach((channel) => saveChannel(channel.componentState))
    emitter.emit('render:tick')
  })
}

module.exports = {
  component: FilterBar,
  store,
}
