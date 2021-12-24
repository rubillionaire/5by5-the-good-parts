const fs = require( 'fs' )
const entities = require( 'entities' )
const { XMLParser, XMLBuilder } = require( 'fast-xml-parser' )
const parser = new XMLParser()

const shows = [
  'afterdark',
  'b2w',
  'buildanalyze',
  'hypercritical',
  'talkshow'
].map( function ( file ) {
  const feed = fs.readFileSync( `${ __dirname }/${ file }` ).toString()
  const d = parser.parse( feed )
  d.rss.channel.item = d.rss.channel.item.map( function ( show ) {
    show.title = `${ file } - ${ show.title }`
    return show
  } )
  return d.rss.channel.item
} )
.reduce( function ( prev, curr ) {
  return prev.concat( curr )
}, [] )
.map( function ( item ) {
  item.author = entities.encodeXML( item.author )
  item.description = entities.encodeXML( item.description )
  item[ 'itunes:summary' ] = entities.encodeXML( item[ 'itunes:summary' ] )
  return item
} )
.sort( function ( a, b ) {
  const ad = new Date( a.pubDate )
  const bd = new Date( b.pubDate )
  return bd - ad
} )

const mergedFeed = {
  '?xml': '',
  rss: {
    channel: {
      title: '5by5 the good parts',
      link: '5by5.tv',
      description: entities.encodeXML(
        'Combined feed of Back 2 Work, Build and Analyze, Hypercritical, the Talk Show & the After Dark feeds.'
      ),
      language: 'en-us',
      item: shows,
    }
  }
}

const builder = new XMLBuilder()
const xml = builder.build( mergedFeed )

fs.writeFileSync( `${ __dirname }/5by5-good-parts.xml`, xml )
