import * as dotenv from 'dotenv'
import fetch from 'node-fetch'

dotenv.config()

if (!process.env.ENTU_URL) throw new Error('ENTU_URL missing in environment')
if (!process.env.ENTU_ACCOUNT) throw new Error('ENTU_ACCOUNT missing in environment')
if (!process.env.ENTU_KEY) throw new Error('ENTU_KEY missing in environment')
if (!process.env.SPACES_ENDPOINT) throw new Error('SPACES_ENDPOINT missing in environment')
if (!process.env.SPACES_BUCKET) throw new Error('SPACES_BUCKET missing in environment')
if (!process.env.SPACES_KEY) throw new Error('SPACES_KEY missing in environment')
if (!process.env.SPACES_SECRET) throw new Error('SPACES_SECRET missing in environment')

let TOKEN
getAllData()

async function getAllData () {
  TOKEN = await getToken()

  console.log(`${new Date().toISOString()} START`)

  const medias = await getMedias()
  console.log(`${new Date().toISOString()} Medias: ${medias.length}`)

  const playlistMedias = await getPlaylistsMedias()
  console.log(`${new Date().toISOString()} PlaylistMedias: ${playlistMedias.length}`)

  const playlists = await getPlaylists()
  console.log(`${new Date().toISOString()} Playlists: ${playlists.length}`)

  const layoutPlaylist = await getLayoutPlaylist()
  console.log(`${new Date().toISOString()} LayoutPlaylist: ${layoutPlaylist.length}`)

  const layouts = await getLayouts()
  console.log(`${new Date().toISOString()} Layouts: ${layouts.length}`)

  const schedules = await getSchedules()
  console.log(`${new Date().toISOString()} Schedules: ${schedules.length}`)

  const configurations = await getConfigurations()
  console.log(`${new Date().toISOString()} Configurations: ${configurations.length}`)

  const screenGroups = await getScreenGroups()
  console.log(`${new Date().toISOString()} ScreenGroups: ${screenGroups.length}`)

  const screens = await getScreens()
  console.log(`${new Date().toISOString()} Screens: ${screens.length}`)
  console.log(`${new Date().toISOString()} END\n\n`)

  setTimeout(getAllData, 30 * 1000)
}

async function getToken () {
  const response = await fetch(`${process.env.ENTU_URL}/auth?account=${process.env.ENTU_ACCOUNT}`, { headers: { Authorization: `Bearer ${process.env.ENTU_KEY}` } })

  if (!response.ok) {
    console.error(await response.json())
    throw new Error('Failed to fetch token')
  }

  const { token } = await response.json()

  return token
}

async function getMedias () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_media',
    'type._id.exists': true,
    '_sharing.string': 'public',
    props: [
      '_mid.string',
      'file._id',
      'file.filename',
      'height.number',
      'name.string',
      'type.string',
      'url.string',
      'valid_from.datetime',
      'valid_to.datetime',
      'width.number'
    ].join(','),
    sort: 'ordinal',
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    file: getValue(x.file, '_id'),
    fileName: getValue(x.file, 'filename'),
    height: getValue(x.height, 'number'),
    name: getValue(x.name),
    type: getValue(x.type),
    url: getValue(x.url),
    validFrom: getValue(x.valid_from, 'datetime'),
    validTo: getValue(x.valid_to, 'datetime'),
    width: getValue(x.width, 'number')
  }))
}

async function getPlaylistsMedias () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_playlist_media',
    '_parent._id.exists': true,
    'media._id.exists': true,
    props: [
      '_mid.string',
      '_parent.reference',
      'animate.reference',
      'delay.number',
      'duration.number',
      'media.reference',
      'mute.boolean',
      'name.string',
      // 'ordinal.number',
      'stretch.boolean',
      'valid_from.datetime',
      'valid_to.datetime'
    ].join(','),
    sort: 'ordinal',
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    animate: getValue(x.animate, 'reference'),
    delay: getValue(x.delay, 'number'),
    duration: getValue(x.duration, 'number'),
    media: getValue(x.media, 'reference'),
    mute: getValue(x.mute, 'boolean') === true,
    name: getValue(x.name),
    stretch: getValue(x.stretch, 'boolean') === true,
    validFrom: getValue(x.valid_from, 'datetime'),
    validTo: getValue(x.valid_to, 'datetime')
  }))
}

async function getPlaylists () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_playlist',
    props: [
      '_mid.string',
      'animate.reference',
      'delay.number',
      'name.string',
      'valid_from.datetime',
      'valid_to.datetime'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    animate: getValue(x.animate, 'reference'),
    delay: getValue(x.delay, 'number'),
    name: getValue(x.name),
    validFrom: getValue(x.valid_from, 'datetime'),
    validTo: getValue(x.valid_to, 'datetime')
  }))
}

async function getLayoutPlaylist () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_layout_playlist',
    '_parent._id.exists': true,
    'playlist._id.exists': true,
    props: [
      '_mid.string',
      '_parent.reference',
      'height.number',
      'in_pixels.boolean',
      'left.number',
      'loop.boolean',
      'name.string',
      'playlist.reference',
      'top.number',
      'width.number',
      'zindex.number'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    height: getValue(x.height, 'number'),
    inPixels: getValue(x.in_pixels, 'boolean') === true,
    layouts: x._parent.map(x => x.reference),
    left: getValue(x.left, 'number'),
    loop: getValue(x.loop, 'boolean') === true,
    name: getValue(x.name),
    playlist: getValue(x.playlist, 'reference'),
    top: getValue(x.top, 'number'),
    width: getValue(x.width, 'number'),
    zindex: getValue(x.zindex, 'number')
  }))
}

async function getLayouts () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_layout',
    props: [
      '_mid.string',
      'height.number',
      'name.string',
      'width.number'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    height: getValue(x.height, 'number'),
    name: getValue(x.name),
    width: getValue(x.width, 'number')
  }))
}

async function getSchedules () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_schedule',
    '_parent._id.exists': true,
    'layout._id.exists': true,
    props: [
      '_mid.string',
      '_parent.reference',
      // 'action.string',
      'cleanup.boolean',
      'crontab.string',
      // 'duration.number',
      'layout.reference',
      'name.string',
      // 'ordinal.number',
      'valid_from.datetime',
      'valid_to.datetime'
    ].join(','),
    sort: 'ordinal',
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    configurations: x._parent.map(x => x.reference),
    cleanup: getValue(x.cleanup, 'boolean') === true,
    crontab: getValue(x.crontab),
    layout: getValue(x.layout, 'reference'),
    name: getValue(x.name),
    validFrom: getValue(x.valid_from, 'datetime'),
    validTo: getValue(x.valid_to, 'datetime')
  }))
}

async function getConfigurations () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_configuration',
    props: [
      '_mid.string',
      'name.string',
      'update_interval.number'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    name: getValue(x.name),
    updateInterval: getValue(x.update_interval, 'number')
  }))
}

async function getScreenGroups () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_screen_group',
    'configuration._id.exists': true,
    'ispublished.boolean': true,
    props: [
      '_mid.string',
      'configuration.reference',
      // 'feedback.string',
      // 'ispublished.boolean',
      'name.string',
      'published.datetime'
      // 'responsible.reference'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    name: getValue(x.name),
    configuration: getValue(x.configuration, 'reference'),
    publishedAt: getValue(x.published, 'datetime')
  }))
}

async function getScreens () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_screen',
    'screen_group._id.exists': true,
    props: [
      '_mid.string',
      // 'customer.reference',
      // 'entu_api_key.string',
      // 'log.file',
      'name.string',
      // 'notes.string',
      // 'photo.file',
      'published.string',
      'screen_group.reference'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: getValue(x._mid),
    name: getValue(x.name),
    publishedAt: getValue(x.published),
    screenGroup: getValue(x.screen_group, 'reference')
  }))
}

async function apiFetch (path, query) {
  const url = new URL(`${process.env.ENTU_URL}/${process.env.ENTU_ACCOUNT}/${path}`)
  if (query) url.search = new URLSearchParams(query).toString()

  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })

  if (!response.ok) {
    console.error(await response.json())
    throw new Error(`Failed to fetch ${path}`)
  }

  return response.json()
}

function getId (entity) {
  const _id = getValue(entity._mid)

  if (_id) {
    return parseInt(_id)
  } else {
    return entity._id
  }
}

function getValue (valueList = [], type = 'string', locale = 'en') {
  return valueList.find(x => x.language === locale)?.[type] || valueList.find(x => !x.language)?.[type] || valueList?.at(0)?.[type]
}
