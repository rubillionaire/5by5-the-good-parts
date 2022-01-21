function renderTick (state, emitter) {
  emitter.on('render:tick', () => {
    state.playlist.tick += 1
    emitter.emit('render')
  })
}

module.exports = renderTick
