const { serverDomain } = require('./config.js')
const host = serverDomain

const HTTP_PORT = 8081
const WS_PORT = 8082

;(async () => {

  const { Server: HyperspaceServer } = require('hyperspace')
  const dbServer = new HyperspaceServer({
    storage: './database',
    host,
  })
  await dbServer.ready()

  const { Client: HyperspaceClient } = require('hyperspace')
  const client = new HyperspaceClient({ host })

  const Hyperbee = require('hyperbee')
  const log = client.corestore().get({ name: '5by5-the-good-parts' })
  await log.ready()

  const bee = new Hyperbee(log, {
    keyEncoding: 'binary',
    valueEncoding: 'json'
  })
  await bee.ready()

  var WebSocketServer = require('rpc-websockets').Server

  var wsServer = new WebSocketServer({
    port: WS_PORT,
    host,
  })

  wsServer.register('state-set', async ({ key, value }) => {
    try {
      const result = await bee.put(key, value)
      return { result }
    } catch (error) {
      return { error }
    }
  })

  wsServer.register('state-get', async ({ timestamp } = {}) => {
    const result = {}
    return new Promise((resolve, reject) => {
      bee.createReadStream()
        .on('data', ({ key, value }) => {
          key = key.toString()
          if (timestamp <= value.timestamp) {
            result[key] = value
          }
          else if (timestamp === null) {
            result[key] = value
          }
        })
        .on('end', () => {
          resolve({ result })
        })
    })
  })

  const staticHandler = require('serve-handler')
  const http = require('http')
  const server = http.createServer((request, response) => {
    staticHandler(request, response, {public: 'public'})
  })
  server.listen(HTTP_PORT, () => {
    console.log(`http://${host}:${HTTP_PORT}`)
  })

  process.on('exit', (code) => {
    server.close()
    wsServer.close()
  })
})()
