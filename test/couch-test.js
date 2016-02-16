'use strict';

const test = require('blue-tape');
const nock = require('nock');

const DbdbCouch = require('../lib/couch');

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
let cookieStr = 'AuthSession="authcookie"; Expires=Tue, 05 Mar 2013 14:06:11 GMT';

// Reply to db.list()
function setupAllDocs(opts) {
  opts = opts || {};
  nock('http://database.fake', opts)
    .get('/feednstatus/_all_docs')
    .reply(200);
}

// Reply to nano.auth()
function setupSession(pw) {
  pw = pw || 'thepassword';
  nock('http://database.fake')
    .post('/_session', new RegExp('name=thekey&password=' + pw))
    .reply(200, {ok: true}, {'Set-Cookie': cookieStr});
}

// Tests

test('DbdbCouch', (t) => {
  t.equal(typeof DbdbCouch, 'function', 'should be a function');
  t.end();
});

// Tests -- database connection

test('db.connect', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.connect, 'function', 'should exist');
  t.end();
});

test('db.connect return', function (t) {
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
  });
});

test('auth cookie', (t) => {
  t.plan(1);
  setupSession();
  let db = new DbdbCouch(authConfig);

  db.connect()

  .then((conn) => {
    setupAllDocs({reqheaders: {Cookie: cookieStr}});

    conn.list((err, body) => {
      t.notOk(err, 'should be used');

      db.disconnect();
    });
  });
});

test('db.connect reuse', function (t) {
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

test('db.disconnect', function (t) {
  let db = new DbdbCouch(config);

  t.equal(typeof db.disconnect, 'function', 'should exist');
  t.end();
});

test('db.disconnect should close connection', function (t) {
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
