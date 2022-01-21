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

const browserify = require('browserify')
const envify = require('envify/custom')
const fs = require('fs')
 
const b = browserify('browser/app.js')
const output = fs.createWriteStream('public/bundle.js')
 
b.transform(envify({
  SERVER_DOMAIN: ip,
}))
b.bundle().pipe(output)
