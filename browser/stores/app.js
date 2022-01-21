async function appStore (state, emitter) {
  state.playlist = {
    shows: [],
    channels: [],
    tick: 0,
    player: {
      show: { id: null },
    },
  }
}

module.exports = appStore
