import test from 'ava'
import {setupNock, teardownNock} from './helpers/http'

import DbdbCouch from '../lib/couchdb'

// Config without authorization
const getConfig = (nock) => ({url: (nock) ? nock.basePath : 'http://test.url', db: 'feednstatus'})

// Config with key and password
const getAuthConfig = (nock) => ({
  url: (nock) ? nock.basePath : 'http://test.url',
  db: 'feednstatus',
  key: 'thekey',
  password: 'thepassword'
})

// Cookie string
const cookieStr = 'AuthSession=authcookie; Version=1; Expires=Tue, 05 Mar 2023 14:06:11 GMT; ' +
  'Max-Age=86400; Path=/; HttpOnly Secure'
const cookieArr = [cookieStr, 'remember=something']

// Reply to db.list()
function setupAllDocs (opts, count = 1, nock) {
  opts = opts || {}
  return setupNock(nock, opts)
    .get('/feednstatus/_all_docs').times(count)
    .reply(200)
}

// Reply to nano.auth()
function setupSession (pw, cookie, nock) {
  pw = pw || 'thepassword'
  cookie = cookie || cookieStr
  return setupNock(nock)
    .post('/_session', {name: 'thekey', password: pw})
    .reply(200, {ok: true}, {'Set-Cookie': cookie})
}

// Tests

test('DbdbCouch should be a function', (t) => {
  t.is(typeof DbdbCouch, 'function')
})

test('DbdbCouch.dbType should be "couchdb"', (t) => {
  t.is(DbdbCouch.dbType, 'couchdb')
})

test('db.dbType should be couchdb', (t) => {
  const db = new DbdbCouch()

  t.is(db.dbType, 'couchdb')
})

// Tests -- config

test('should set config', (t) => {
  const config = {url: 'http://fake.com', db: 'oranges'}

  const db = new DbdbCouch(config)

  t.deepEqual(db.config, config)
})

test('should clone config', (t) => {
  const config = {url: 'http://fake.com', db: 'oranges'}
  Object.freeze(config)

  const db = new DbdbCouch(config)

  t.not(db.config, config)
})

// Tests -- database connection

test('db.connect should exist', (t) => {
  const db = new DbdbCouch(getConfig())

  t.is(typeof db.connect, 'function')
})

test('db.connect should return a nano object', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.connect()

  .then((conn) => {
    t.is(typeof conn, 'object')
    t.is(typeof conn.list, 'function')

    db.disconnect()
  })
})

test.cb('db.connect should use config url and db', (t) => {
  const nock = setupAllDocs()
  const db = new DbdbCouch(getConfig(nock))

  db.connect()

  .then((conn) => {
    conn.list((err, body) => {
      t.falsy(err)

      db.disconnect()
      teardownNock(nock)
      t.end()
    }, t.end)
  })
})

test('db.connect should use auth with key and password', (t) => {
  const nock = setupSession()
  const db = new DbdbCouch(getAuthConfig(nock))

  return db.connect()

  .then((conn) => {
    // Just getting here is a sign of authorization
    t.pass()

    db.disconnect()
    teardownNock(nock)
  })
})

test('db.connect should fail on wrong password', (t) => {
  const nock = setupSession('otherpassword')
  const db = new DbdbCouch(getAuthConfig(nock))

  return db.connect()

  .catch((err) => {
    if (err) {
      // Just getting here is a sign of failure
      t.pass()
    }

    db.disconnect()
    teardownNock(nock)
  })
})

test.cb('db.connect should use auth cookie', (t) => {
  const nock = setupSession()
  setupAllDocs({reqheaders: {Cookie: 'AuthSession=authcookie'}}, 1, nock)
  const db = new DbdbCouch(getAuthConfig(nock))

  db.connect()

  .then((conn) => {
    conn.list((err, body, headers) => {
      // t.is(headers, {})
      t.falsy(err)

      db.disconnect()
      teardownNock(nock)
      t.end()
    }, t.end)
  })
})

test.cb('db.connect should use auth cookie with more cookies', (t) => {
  const nock = setupSession(null, cookieArr)
  setupAllDocs({reqheaders: {Cookie: 'AuthSession=authcookie'}}, 1, nock)
  const db = new DbdbCouch(getAuthConfig(nock))

  db.connect()

  .then((conn) => {
    conn.list((err, body) => {
      t.falsy(err)

      db.disconnect()
      teardownNock(nock)
      t.end()
    }, t.end)
  })
})

test.cb('db.connect should reuse authcookie for two parallel connections', (t) => {
  const nock = setupSession()
  setupAllDocs({reqheaders: {Cookie: 'AuthSession=authcookie'}}, 2, nock)
  const db = new DbdbCouch(getAuthConfig(nock))

  Promise.all([
    db.connect(),
    db.connect()
  ])

  .then((conns) => Promise.all([
    new Promise((resolve, reject) => { conns[0].list((err0, body) => { t.falsy(err0); resolve(conns[0]) }) }),
    new Promise((resolve, reject) => { conns[1].list((err1, body) => { t.falsy(err1); resolve(conns[1]) }) })
  ]))

  .then((conns) => {
    t.is(conns[0], conns[1])

    db.disconnect()
    teardownNock(nock)
    t.end()
  }, t.end)
})

test('db.connect should reuse connection', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.connect()
  .then((conn1) => {
    return db.connect()

    .then((conn2) => {
      t.is(conn1, conn2)

      db.disconnect()
    })
  })
})

// Tests -- db.disconnect

test('db.disconnect should exist', (t) => {
  const db = new DbdbCouch(getConfig())

  t.is(typeof db.disconnect, 'function')
})

test('db.disconnect should close connection', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.connect()
  .then((conn1) => {
    db.disconnect()
    return db.connect()

    .then((conn2) => {
      t.not(conn1, conn2)

      db.disconnect()
    })
  })
})
