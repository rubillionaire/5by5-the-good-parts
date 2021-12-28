const fs = require( 'fs' )
const entities = require( 'entities' )
const xml2js = require( 'xml2js' )
const async = require( 'async' )

const files = [
  'afterdark',
  'b2w',
  'buildanalyze',
  'hypercritical',
  'talkshow'
]

async.map( files, filesToShows, handleShows )

function filesToShows ( file, callback ) {
  const feed = fs.readFileSync( `${ __dirname }/${ file }` ).toString()
  xml2js.parseString( feed, { noValidation: true }, function ( err, d ) {
    d.rss.channel[ 0 ].item = d.rss.channel[ 0 ].item.map( function ( show ) {
      show.title[ 0 ] = `${ file } - ${ show.title[ 0 ] }`
      return show
    } )
    callback( err, d.rss.channel[ 0 ].item )
  } )
}

function handleShows ( err, shows ) {
  shows = shows
    .reduce( function ( prev, curr ) {
      return prev.concat( curr )
    }, [] )
    .sort( function ( a, b ) {
      const ad = new Date( a.pubDate[ 0 ] )
      const bd = new Date( b.pubDate[ 0 ] )
      return ad - bd
    } )

  fs.writeFileSync(
    `${__dirname}/public/shows.json`,
    JSON.stringify( shows, null, 2 )
  )

  // const feed = mergedFeed( shows )
  // const builder = new xml2js.Builder()
  // const xml = builder.buildObject( feed )
  // fs.writeFileSync( `${ __dirname }/5by5-good-parts.xml`, xml )
}

function mergedFeed ( shows ) {
  return {
    rss: {
      '$': {
        version: '2.0',
        'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
        'xmlns:sy': 'http://purl.org/rss/1.0/modules/syndication/',
        'xmlns:admin': 'http://webns.net/mvcb/',
        'xmlns:atom': 'http://www.w3.org/2005/Atom/',
        'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
        'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd'
      },
      channel: [ {
        title: [ '5by5 the Good Parts' ],
        link: [ 'http://5by5.tv/' ],
        pubDate: [ 'Tue, 30 Apr 2019 18:30:00 GMT' ],
        description: [
          '5by5 the Good Parts'
        ],
        language: [ 'en-us' ],
        item: [ shows ]
      } ]
    }
  }
}
