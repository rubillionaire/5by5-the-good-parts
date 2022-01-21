const { networkInterfaces } = require('os')

const nis = networkInterfaces()

let ip = ''

Object.keys(nis).forEach((niKey) => {
  const ni = nis[niKey]
  ni.forEach((niSpec) => {
    if (niSpec.address.startsWith('192')) {
      ip = niSpec.address
    }
  })
})

module.exports.serverDomain = ip
