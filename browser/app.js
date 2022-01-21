const debug = require('debug')('app')

const choo = require('choo')
const html = require('choo/html')

const FilterBar = require('./components/filter-bar')
const ShowList = require('./components/show-list')
const ActionBar = require('./components/action-bar')

const { store: showItemStore } = require('./components/show-item')
const { store: playerStore } = require('./components/player')
const { store: actionBarStore } = require('./components/action-bar')

const appStore = require('./stores/app')
const renderTick = require('./stores/render-tick')
const PersistantStore = require('./stores/persistant')
const ShowStore = require('./stores/shows')

const app = choo({ cache: 2000 })
app.use(appStore)
app.use(renderTick)
app.use(actionBarStore)

;(async () => {
  const persistantStore = await PersistantStore()

  const response = await fetch('shows.json')
  const feed = await response.json()

  app.use(ShowStore({ feed, persistantStore }))
  app.use(showItemStore(persistantStore))
  app.use(playerStore(persistantStore))
  app.use(FilterBar.store(persistantStore))

  app.use((state, emitter) => {
    emitter.emit('render:tick')
  })
  
  app.route('/', mainView)
  app.route('/5by5-the-good-parts', mainView)
  app.route('/5by5-the-good-parts/', mainView)
  app.mount('#app')
})()


function mainView (state, emit) {
  console.log('main view')
  return html`
    <div id="app">
      ${state.cache(FilterBar.component, 'filter-bar').render()}
      ${state.cache(ShowList.component, 'show-list').render()}
      ${state.cache(ActionBar.component, 'action-bar').render()}
    </div>
  `
}
