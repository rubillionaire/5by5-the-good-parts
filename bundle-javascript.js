const { serverDomain } = require('./config.js')

const browserify = require('browserify')
const envify = require('envify/custom')
const fs = require('fs')
 
const b = browserify('ui.js')
const output = fs.createWriteStream('public/bundle.js')
 
b.transform(envify({
  SERVER_DOMAIN: serverDomain,
}))
b.bundle().pipe(output)
