const nock = require('nock')

let index = 1

const setupNock = (scope, opts) => {
  const url = (scope) ? scope.basePath : 'http://test' + (index++) + '.url:8888'
  return nock(url, opts)
}

const teardownNock = () => {
  // nock.cleanAll()
}

module.exports = {
  setupNock,
  teardownNock
}
