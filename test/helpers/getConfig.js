// Config for connections
module.exports = (nock) => ({url: (nock) ? nock.basePath : 'http://test.url', db: 'feednstatus'})
