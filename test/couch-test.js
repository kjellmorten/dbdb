import test from 'ava'
import nock from 'nock'

import DbdbCouch from '../lib/couchdb'

// Config without authorization
const config = {
  url: 'http://database.fake',
  db: 'feednstatus'
}

// Config with key and password
const authConfig = {
  url: 'http://database.fake',
  db: 'feednstatus',
  key: 'thekey',
  password: 'thepassword'
}

// Cookie string
const cookieStr = 'AuthSession="authcookie" Version=1 Expires=Tue, 05 Mar 2013 14:06:11 GMT ' +
  'Max-Age=86400 Path=/ HttpOnly Secure'
const cookieArr = [cookieStr, 'remember:something']

// Reply to db.list()
function setupAllDocs (opts) {
  opts = opts || {}
  nock('http://database.fake', opts)
    .get('/feednstatus/_all_docs')
    .reply(200)
}

// Reply to nano.auth()
function setupSession (pw, cookie) {
  pw = pw || 'thepassword'
  cookie = cookie || cookieStr
  nock('http://database.fake')
    .post('/_session', new RegExp('name=thekey&password=' + pw))
    .reply(200, {ok: true}, {'Set-Cookie': cookie})
}

function teardownNock () {
  nock.cleanAll()
}

// Ask for connection, then list databases
// Asumes that error is caused by auth failure
function connectAndList (t, db, no) {
  return db.connect().then((conn) => {
    return new Promise((resolve, reject) => {
      conn.list((err, body) => {
        t.falsy(err, `conn${no} should be authorized`)
        resolve(conn)
      })
    })
  })
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

// Tests -- database connection

test('db.connect should exist', (t) => {
  const db = new DbdbCouch(config)

  t.is(typeof db.connect, 'function')
})

test('db.connect should return a nano object', (t) => {
  const db = new DbdbCouch(config)

  return db.connect()

  .then((conn) => {
    t.is(typeof conn, 'object')
    t.is(typeof conn.list, 'function')

    db.disconnect()
  })
})

test('db.connect should use config url and db', (t) => {
  setupAllDocs()
  const db = new DbdbCouch(config)

  db.connect()

  .then((conn) => {
    conn.list((err, body) => {
      t.falsy(err)

      db.disconnect()
      teardownNock()
    })
  })
})

test('db.connect should use auth with key and password', (t) => {
  setupSession()
  const db = new DbdbCouch(authConfig)

  return db.connect()

  .then((conn) => {
    // Just getting here is a sign of authorization
    t.pass()

    db.disconnect()
    teardownNock()
  })
})

test('db.connect should fail on wrong password', (t) => {
  setupSession('otherpassword')
  const db = new DbdbCouch(authConfig)

  return db.connect()

  .catch((err) => {
    if (err) {
      // Just getting here is a sign of failure
      t.pass()
    }

    db.disconnect()
    teardownNock()
  })
})

test.serial('db.connect should use auth cookie', (t) => {
  setupSession()
  setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}})
  const db = new DbdbCouch(authConfig)

  db.connect()

  .then((conn) => {
    conn.list((err, body) => {
      t.falsy(err)

      db.disconnect()
      teardownNock()
    })
  })
})

test.serial('db.connect should use auth cookie with more cookies', (t) => {
  setupSession(null, cookieArr)
  setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}})
  const db = new DbdbCouch(authConfig)

  db.connect()

  .then((conn) => {
    conn.list((err, body) => {
      t.falsy(err)

      db.disconnect()
      teardownNock()
    })
  })
})

test.skip('db.connect should reuse authcookie for two parallel connections', (t) => {
  setupSession()
  setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}})
  setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}})
  const db = new DbdbCouch(authConfig)

  return Promise.all([
    connectAndList(t, db, 1),
    connectAndList(t, db, 2)
  ])

  .then((conns) => {
    t.is(conns[0], conns[1])

    db.disconnect()
    teardownNock()
  })
})

test('db.connect should reuse connection', (t) => {
  const db = new DbdbCouch(config)

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
  const db = new DbdbCouch(config)

  t.is(typeof db.disconnect, 'function')
})

test('db.disconnect should close connection', (t) => {
  const db = new DbdbCouch(config)

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
