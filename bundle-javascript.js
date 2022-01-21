const argv = process.argv.slice(2)
const watch = argv.indexOf('--watch') > -1
  ? true
  : false

const { serverDomain } = require('./config.js')

const browserify = require('browserify')
const envify = require('envify/custom')
const fs = require('fs')
 
const b = browserify('browser/app.js')
const output = fs.createWriteStream('public/bundle.js')

if (watch) {
  b.plugin(require('watchify'))
}
 
b.transform(envify({
  SERVER_DOMAIN: serverDomain,
}))
b.bundle().pipe(output)
