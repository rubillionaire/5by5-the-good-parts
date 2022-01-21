const debug = require('debug')('show-list')
const html = require('choo/html')
const Component = require('choo/component')
const { component: ShowItem } = require('./show-item')

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
    debug('show-list:create')
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
    debug('show-list:update')
    if (this.local.shows.length !== this.state.playlist.shows.length) {
      return true
    }
    if (this.local.tick !== this.state.playlist.tick) {
      return true
    }
    return false
  }
}

module.exports = {
  component: ShowList,
}
