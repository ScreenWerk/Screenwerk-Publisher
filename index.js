import * as dotenv from 'dotenv'
import fetch from 'node-fetch'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

dotenv.config()

if (!process.env.ENTU_URL) throw new Error('ENTU_URL missing in environment')
if (!process.env.ENTU_ACCOUNT) throw new Error('ENTU_ACCOUNT missing in environment')
if (!process.env.ENTU_KEY) throw new Error('ENTU_KEY missing in environment')
if (!process.env.SPACES_ENDPOINT) throw new Error('SPACES_ENDPOINT missing in environment')
if (!process.env.SPACES_BUCKET) throw new Error('SPACES_BUCKET missing in environment')
if (!process.env.SPACES_KEY) throw new Error('SPACES_KEY missing in environment')
if (!process.env.SPACES_SECRET) throw new Error('SPACES_SECRET missing in environment')

let TOKEN

main()

async function main () {
  log('START')

  const files = await getAllData()

  for (const file of files) {
    log(`Uploading ${file.key}`)

    await uploadFile(`screen/${file.key}`, file.json)

    // if (file.oldKey) {
    //   await uploadFile(file.oldKey, file.json)
    // }
  }

  log('END\n\n')

  setTimeout(main, 60 * 1000)
}

async function getAllData () {
  TOKEN = await getToken()

  const medias = await getMedias()
  log(`Medias: ${medias.length}`)

  const playlistMedias = await getPlaylistsMedias()
  log(`PlaylistMedias: ${playlistMedias.length}`)

  const playlists = await getPlaylists()
  log(`Playlists: ${playlists.length}`)

  const layoutPlaylists = await getLayoutPlaylists()
  log(`LayoutPlaylists: ${layoutPlaylists.length}`)

  const layouts = await getLayouts()
  log(`Layouts: ${layouts.length}`)

  const schedules = await getSchedules()
  log(`Schedules: ${schedules.length}`)

  const configurations = await getConfigurations()
  log(`Configurations: ${configurations.length}`)

  const screenGroups = await getScreenGroups()
  log(`ScreenGroups: ${screenGroups.length}`)

  const screens = await getScreens()
  log(`Screens: ${screens.length}`)

  const files = screens.map(screen => {
    const screenGroup = screenGroups.find(x => x._id === screen.screenGroup)
    if (!screenGroup) return undefined

    const configuration = configurations.find(x => x._id === screenGroup.configuration)
    if (!configuration) return undefined

    const schedulesForScreen = schedules.filter(x => x.configurations.includes(configuration._id))

    return {
      _mid: screen._mid,
      configurationEid: configuration._id,
      screenGroupEid: screenGroup._id,
      screenEid: screen._id,
      publishedAt: new Date().toISOString(),
      updateInterval: configuration.updateInterval,
      schedules: schedulesForScreen.map(schedule => {
        const layout = layouts.find(x => x._id === schedule.layout)
        if (!layout) return undefined

        const layoutPlaylistsForSchedule = layoutPlaylists.filter(x => x.layouts.includes(layout._id))
        if (!layoutPlaylistsForSchedule.length) return undefined

        return {
          eid: schedule._id,
          cleanup: schedule.cleanup,
          crontab: schedule.crontab,
          duration: schedule.duration,
          ordinal: schedule.ordinal,
          layoutEid: layout._id,
          name: layout.name,
          validFrom: schedule.validFrom,
          validTo: schedule.validTo,
          layoutPlaylists: layoutPlaylistsForSchedule.map(layoutPlaylist => {
            const playlist = playlists.find(x => x._id === layoutPlaylist.playlist)
            if (!playlist) return undefined

            const playlistMediasForLayoutPlaylist = playlistMedias.filter(x => x.playlists.includes(playlist._id))
            if (!playlistMediasForLayoutPlaylist.length) return undefined

            return {
              eid: layoutPlaylist._id,
              name: playlist.name,
              left: layoutPlaylist.left,
              top: layoutPlaylist.top,
              width: layoutPlaylist.width,
              height: layoutPlaylist.height,
              inPixels: layoutPlaylist.inPixels,
              zindex: layoutPlaylist.zindex,
              loop: layoutPlaylist.loop,
              playlistEid: playlist._id,
              validFrom: playlist.validFrom,
              validTo: playlist.validTo,
              playlistMedias: playlistMediasForLayoutPlaylist.map(playlistMedia => {
                const media = medias.find(x => x._id === playlistMedia.media)
                if (!media) return undefined

                return {
                  playlistMediaEid: playlistMedia._id,
                  duration: playlistMedia.duration,
                  delay: playlistMedia.delay,
                  mute: playlistMedia.mute,
                  ordinal: playlistMedia.ordinal,
                  stretch: playlistMedia.stretch,
                  mediaEid: media._id,
                  file: `${process.env.ENTU_URL}/${process.env.ENTU_ACCOUNT}/property/${media.fileId}?download=true`,
                  fileName: media.fileName,
                  height: media.height,
                  width: media.width,
                  name: media.name,
                  type: media.type,
                  url: media.url
                }
              }).filter(x => x !== undefined).sort((a, b) => a.ordinal - b.ordinal)
            }
          }).filter(x => x?.playlistMedias.length > 0)
        }
      }).filter(x => x?.layoutPlaylists.length > 0).sort((a, b) => a.ordinal - b.ordinal)
    }
  }).filter(x => x?.schedules.length > 0)

  return files.map(file => ({
    key: `${file.screenEid}.json`,
    oldKey: file._mid ? `${file._mid}.json` : undefined,
    json: JSON.stringify(file)
  }))
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
      'file._id',
      'file.filename',
      'height.number',
      'name.string',
      'type.string',
      'url.string',
      // 'valid_from.datetime',
      'valid_to.datetime',
      'width.number'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    fileId: getValue(x.file, '_id'),
    fileName: getValue(x.file, 'filename'),
    height: getValue(x.height, 'number'),
    name: getValue(x.name),
    type: getValue(x.type),
    url: getValue(x.url),
    validTo: getValue(x.valid_to, 'datetime'),
    width: getValue(x.width, 'number')
  })).filter(x => !x.validTo || new Date(x.validTo) >= new Date())
}

async function getPlaylistsMedias () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_playlist_media',
    '_parent._id.exists': true,
    'media._id.exists': true,
    props: [
      '_parent.reference',
      // 'animate.reference',
      'delay.number',
      'duration.number',
      'media.reference',
      'mute.boolean',
      // 'name.string',
      'ordinal.number',
      'stretch.boolean',
      // 'valid_from.datetime',
      'valid_to.datetime'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    delay: getValue(x.delay, 'number') || 0,
    duration: getValue(x.duration, 'number'),
    media: getValue(x.media, 'reference'),
    mute: getValue(x.mute, 'boolean') === true,
    ordinal: getValue(x.ordinal, 'number') || 0,
    playlists: x._parent.map(x => x.reference),
    stretch: getValue(x.stretch, 'boolean') === true,
    validTo: getValue(x.valid_to, 'datetime')
  })).filter(x => !x.validTo || new Date(x.validTo) >= new Date())
}

async function getPlaylists () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_playlist',
    props: [
      // 'animate.reference',
      // 'delay.number',
      'name.string',
      'valid_from.datetime',
      'valid_to.datetime'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    name: getValue(x.name),
    validFrom: getValue(x.valid_from, 'datetime'),
    validTo: getValue(x.valid_to, 'datetime')
  })).filter(x => !x.validTo || new Date(x.validTo) >= new Date())
}

async function getLayoutPlaylists () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_layout_playlist',
    '_parent._id.exists': true,
    'playlist._id.exists': true,
    props: [
      '_parent.reference',
      'height.number',
      'in_pixels.boolean',
      'left.number',
      'loop.boolean',
      // 'name.string',
      'playlist.reference',
      'top.number',
      'width.number',
      'zindex.number'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    height: getValue(x.height, 'number') || 0,
    inPixels: getValue(x.in_pixels, 'boolean') === true,
    layouts: x._parent.map(x => x.reference),
    left: getValue(x.left, 'number') || 0,
    loop: getValue(x.loop, 'boolean') === true,
    playlist: getValue(x.playlist, 'reference'),
    top: getValue(x.top, 'number') || 0,
    width: getValue(x.width, 'number') || 0,
    zindex: getValue(x.zindex, 'number') || 0
  }))
}

async function getLayouts () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_layout',
    props: [
      'height.number',
      'name.string',
      'width.number'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    height: getValue(x.height, 'number') || 0,
    name: getValue(x.name),
    width: getValue(x.width, 'number') || 0
  }))
}

async function getSchedules () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_schedule',
    '_parent._id.exists': true,
    'layout._id.exists': true,
    props: [
      '_parent.reference',
      // 'action.string',
      'cleanup.boolean',
      'crontab.string',
      'duration.number',
      'layout.reference',
      // 'name.string',
      'ordinal.number',
      'valid_from.datetime',
      'valid_to.datetime'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    configurations: x._parent.map(x => x.reference),
    cleanup: getValue(x.cleanup, 'boolean') === true,
    crontab: getValue(x.crontab),
    duration: getValue(x.duration, 'number'),
    layout: getValue(x.layout, 'reference'),
    ordinal: getValue(x.ordinal, 'number') || 0,
    validFrom: getValue(x.valid_from, 'datetime'),
    validTo: getValue(x.valid_to, 'datetime')
  })).filter(x => !x.validTo || new Date(x.validTo) >= new Date())
}

async function getConfigurations () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_configuration',
    props: [
      // 'name.string',
      'update_interval.number'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    updateInterval: getValue(x.update_interval, 'number')
  }))
}

async function getScreenGroups () {
  const { entities } = await apiFetch('entity', {
    '_type.string': 'sw_screen_group',
    'configuration._id.exists': true,
    'ispublished.boolean': true,
    props: [
      'configuration.reference'
      // 'feedback.string',
      // 'ispublished.boolean',
      // 'name.string',
      // 'published.datetime'
      // 'responsible.reference'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    configuration: getValue(x.configuration, 'reference')
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
      // 'name.string',
      // 'notes.string',
      // 'photo.file',
      // 'published.string',
      'screen_group.reference'
    ].join(','),
    limit: 9999
  })

  return entities.map(x => ({
    _id: x._id,
    _mid: parseInt(getValue(x._mid)),
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

async function uploadFile (key, file) {
  const spacesClient = new S3Client({
    endpoint: process.env.SPACES_ENDPOINT,
    credentials: {
      accessKeyId: process.env.SPACES_KEY,
      secretAccessKey: process.env.SPACES_SECRET
    }
  })

  const command = new PutObjectCommand({
    Bucket: process.env.SPACES_BUCKET,
    Key: key,
    Body: file,
    ContentType: 'application/json',
    ACL: 'public-read'
  })

  await spacesClient.send(command)
}

function getValue (valueList = [], type = 'string', locale = 'en') {
  return valueList.find(x => x.language === locale)?.[type] || valueList.find(x => !x.language)?.[type] || valueList?.at(0)?.[type]
}

function log (message) {
  console.log(new Date().toISOString().replace('T', ' ').replace('Z', ''), message)
}
