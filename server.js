const { serverDomain } = require('./config.js')
const host = serverDomain

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
  console.log(bee.feed)
  // await client.replicate(bee.feed) // fetch from the network
  await bee.ready()

  var WebSocketServer = require('rpc-websockets').Server

  // instantiate Server and start listening for requests
  var wsServer = new WebSocketServer({
    port: 8082,
    host: serverDomain,
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
  server.listen(8081, () => {
    console.log('listening on port 8081')
  })

  process.on('exit', (code) => {
    wsServer.close()
  })
})()
