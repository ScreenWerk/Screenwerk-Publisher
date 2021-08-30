const express = require('express')
const fs = require('fs')
const path = require('path')
const aws = require('aws-sdk')

const app = express()

app.listen(process.env.PORT)
console.log('Start serving screen configurations.')

app.get('/', function (req, res) {
  const startAt = process.hrtime()
  let diff = process.hrtime(startAt)
  res.status(204)
  res.send(JSON.stringify({
    error: {
      code: 'Matthew 7:7',
      message: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you',
      screenEid: 'You haven\'t told me',
      responseTimeMs: diff[0] * 1e3 + diff[1] * 1e-6
    }
  }, null, 4))
})

app.get('/configuration/:screenEid', function (req, res) {
  res.redirect('/screen/' + req.params.screenEid)
})

app.get('/screen/:screenEid', function (req, res) {
  // console.log('Meta for screen ' + screenEid + ' requested.')
  const screenEid = req.params.screenEid.replace('.json', '')
  const screenFile = screenEid + '.json'

  const s3 = new aws.S3({
    endpoint: new aws.Endpoint(process.env.SPACES_ENDPOINT),
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET
  })

  s3.headObject({ bucket: process.env.SPACES_BUCKET, key: screenFile }, function(err, metadata) {
    console.log('API', err);
    console.log('API', metadata);
    if (err && err.code === 'NotFound') {
      console.log('Requested screen ' + screenEid + ' is not known.')
    } else {
      res.redirect(process.env.SPACES_URL + '/' + screenFile)
    }
  })
})
