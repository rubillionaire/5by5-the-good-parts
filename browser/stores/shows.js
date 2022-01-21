/**
 * consume a feed of shows and channels to produce the initial
 * state of the application that can be augmented by the persistant
 * state backed by either localStore of remote storage.
 */
const ShowsStore = ({ feed, persistantStore }) => (state, emitter) => {

  const channelForName = (showName) => {
    for (var i = 0; i < feed.channels.length; i++) {
      if (feed.channels[i].file === showName) {
        return feed.channels[i]
      }
    }
  }

  state.playlist.shows = feed.shows
    .map((show) => {
      const { showName, episode } = showTitleEp(show)
      // prep show shape for show list
      show.id = showId({ showName, episode })
      show.channel = channelForName(showName)
      show.episode = episode
      // state of the show in the app
      const persistedState = persistantStore.getShow(show)
      if (persistedState) {
        show.componentState = persistedState
      }
      else {
        show.componentState = {
          lastPlayed: null,
          drawerOpen: false,
          id: show.id,
        }
        persistantStore.saveShow(show.componentState)
      }
      show.playOnOpen = false
      return show
    })

  state.playlist.channels = feed.channels
    .map((channel) => {
      // default app state
      const persistedState = persistantStore.getChannel(channel)
      if (persistedState) {
        channel.componentState = persistedState
      }
      else {
        channel.componentState = {
          displayInPlaylist: true,
          showName: channel.showName,
        }
        persistantStore.saveChannel(channel.componentState)
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
}

module.exports = ShowsStore

function showTitleEp (show) {
  const path = show.guid.replace('http://5by5.tv/', '')
  let [ showName, episode ] = path.split('/')
  episode = episode.split('-')[0]
  return { showName, episode }
}

function showId ({ showName, episode }) {
  return `${showName}-${episode}`
}
