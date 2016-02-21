'use strict';

const test = require('blue-tape');
const nock = require('nock');

const DbdbCouch = require('../lib/couchdb');

// Config without authorization
let config = {
  url: 'http://database.fake',
  db: 'feednstatus'
};

// Config with key and password
let authConfig = {
  url: 'http://database.fake',
  db: 'feednstatus',
  key: 'thekey',
  password: 'thepassword'
};

// Cookie string
let cookieStr = 'AuthSession="authcookie"; Version=1; Expires=Tue, 05 Mar 2013 14:06:11 GMT; ' +
  'Max-Age=86400; Path=/; HttpOnly; Secure';
let cookieArr = [cookieStr, 'remember:something'];

// Reply to db.list()
function setupAllDocs(opts) {
  opts = opts || {};
  nock('http://database.fake', opts)
    .get('/feednstatus/_all_docs')
    .reply(200);
}

// Reply to nano.auth()
function setupSession(pw, cookie) {
  pw = pw || 'thepassword';
  cookie = cookie || cookieStr;
  nock('http://database.fake')
    .post('/_session', new RegExp('name=thekey&password=' + pw))
    .reply(200, {ok: true}, {'Set-Cookie': cookie});
}

function teardownNock() {
  nock.cleanAll();
}

// Ask for connection, then list databases
// Asumes that error is caused by auth failure
function connectAndList(t, db, no) {
  return db.connect().then((conn) => {
    return new Promise((resolve, reject) => {
      conn.list((err, body) => {
        t.notOk(err, `conn${no} should be authorized`);
        resolve(conn);
      });
    });
  });
}

// Tests

test('DbdbCouch', (t) => {
  t.equal(typeof DbdbCouch, 'function', 'should be a function');
  t.end();
});

test('DbdbCouch.dbType', (t) => {
  t.equal(DbdbCouch.dbType, 'couchdb', 'should be "couchdb"');
  t.end();
});

test('db.dbType', (t) => {
  let db = new DbdbCouch();

  t.equal(db.dbType, 'couchdb', 'should be couchdb');
  t.end();
});

// Tests -- database connection

test('db.connect', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.connect, 'function', 'should exist');
  t.end();
});

test('db.connect return', (t) => {
  let db = new DbdbCouch(config);

  return db.connect()

  .then((conn) => {
    t.equal(typeof conn, 'object', 'should be an object');
    t.equal(typeof conn.list, 'function', 'should be nano');

    db.disconnect();
  });
});

test('config url and db', (t) => {
  t.plan(1);
  setupAllDocs();
  let db = new DbdbCouch(config);

  db.connect()

  .then((conn) => {
    conn.list((err, body) => {
      t.notOk(err, 'should be used');

      db.disconnect();
      teardownNock();
    });
  });
});

test('auth with key and password', (t) => {
  setupSession();
  let db = new DbdbCouch(authConfig);

  return db.connect()

  .then((conn) => {
    // Just getting here is a sign of authorization
    t.pass('should be used');

    db.disconnect();
    teardownNock();
  });
});

test('auth failure', (t) => {
  t.plan(1);
  setupSession('otherpassword');
  let db = new DbdbCouch(authConfig);

  return db.connect()

  .catch((err) => {
    if (err) {
      // Just getting here is a sign of failure
      t.pass('should happen');
    }

    db.disconnect();
    teardownNock();
  });
});

test('auth cookie', (t) => {
  t.plan(1);
  setupSession();
  let db = new DbdbCouch(authConfig);

  db.connect()

  .then((conn) => {
    setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}});

    conn.list((err, body) => {
      t.notOk(err, 'should be used');

      db.disconnect();
      teardownNock();
    });
  });
});

test('auth cookie with more cookies', (t) => {
  t.plan(1);
  setupSession(null, cookieArr);
  let db = new DbdbCouch(authConfig);

  db.connect()

  .then((conn) => {
    setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}});

    conn.list((err, body) => {
      t.notOk(err, 'should be used');

      db.disconnect();
      teardownNock();
    });
  });
});

test('db.connect two in parallel', (t) => {
  t.plan(3);
  setupSession();
  setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}});
  setupAllDocs({reqheaders: {Cookie: 'AuthSession="authcookie"'}});
  let db = new DbdbCouch(authConfig);

  return Promise.all([
    connectAndList(t, db, 1),
    connectAndList(t, db, 2)
  ])

  .then((conns) => {
    t.equal(conns[0], conns[1], 'should return the same connection');

    db.disconnect();
    teardownNock();
  });
});

test('db.connect reuse', (t) => {
  t.plan(1);
  let db = new DbdbCouch(config);

  return db.connect()
  .then((conn1) => {
    return db.connect()

    .then((conn2) => {
      t.equal(conn1, conn2, 'should reuse connection');

      db.disconnect();
    });
  });
});

// Tests -- db.disconnect

test('db.disconnect', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.disconnect, 'function', 'should exist');
  t.end();
});

test('db.disconnect should close connection', (t) => {
  let db = new DbdbCouch(config);

  return db.connect()
  .then((conn1) => {
    db.disconnect();
    return db.connect()

    .then((conn2) => {
      t.notEqual(conn1, conn2, 'should reuse connection');

      db.disconnect();
    });
  });
});
