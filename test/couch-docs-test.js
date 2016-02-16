'use strict';

const test = require('blue-tape');
const nock = require('nock');
const sinon = require('sinon');

const DbdbCouch = require('../lib/couch');

// Config for connections
let config = {
  url: 'http://database.fake',
  db: 'feednstatus'
};

// Helpers

function setupGetDoc1() {
  nock('http://database.fake')
    .get('/feednstatus/doc1')
    .reply(200, {
      _id: 'doc1',
      _rev: '2774761001',
      type: 'entry',
      title: 'The title',
      createdAt: '2015-05-23'
    });
}

function setupPostDoc1() {
  nock('http://database.fake')
    .post('/feednstatus', { _id: 'doc1', _rev: '2774761001' })
    .reply(201, {
      ok: true,
      id: 'doc1',
      rev: '2774761004'
    });
}

function setupPostDoc2() {
  nock('http://database.fake')
    .post('/feednstatus', { _id: 'doc2' })
    .reply(201, {
      ok: true,
      id: 'doc2',
      rev: '2774761002'
    });
}

function setupPostDoc3() {
  nock('http://database.fake')
    .post('/feednstatus')
    .reply(201, {
      ok: true,
      id: 'doc3',
      rev: '2774761003'
    });
}

function teardownNock() {
  nock.cleanAll();
}

// Tests -- get document

test('db.get', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.get, 'function', 'should exist');
  t.end();
});

test('db.get return', (t) => {
  setupGetDoc1();
  let db = new DbdbCouch(config);

  return db.get('doc1')

  .then((obj) => {
    t.equal(typeof obj, 'object', 'should be an object');
    t.equal(obj.id, 'doc1', 'should have id');
    t.equal(obj.type, 'entry', 'should have type');
    t.equal(obj.title, 'The title', 'should have title');

    teardownNock();
  });
});

test('db.get exception for non-existing document', (t) => {
  let db = new DbdbCouch(config);

  return db.get('doc2')

  .catch((err) => {
    t.ok(err instanceof Error, 'should be Error');
    t.equal(typeof err.message, 'string', 'should have message');
    t.equal(err.name, 'NotFoundError', 'should have name');
  });
});

test('db.get exception for missing docid', (t) => {
  let db = new DbdbCouch(config);

  return db.get()

  .catch((err) => {
    t.ok(err instanceof Error, 'should be Error');
  });
});

test('db.get exception when connection fails', (t) => {
  setupGetDoc1();
  let db = new DbdbCouch(config);
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'));

  return db.get('doc1')

  .catch((err) => {
    t.equal(err, 'Failure', 'should return connection err');

    db.connect.restore();
    teardownNock();
  });
});

// Tests -- insert document

test('db.insert', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.insert, 'function', 'should exist');
  t.end();
});

test('db.insert insert new document', (t) => {
  setupPostDoc2();
  let doc = {
    id: 'doc2',
    type: 'entry',
    title: 'New title'
  };
  let db = new DbdbCouch(config);

  return db.insert(doc)

  .then((obj) => {
    t.equal(obj.id, 'doc2', 'should return id');
    t.equal(obj.type, 'entry', 'should return type');
    t.equal(obj._rev, '2774761002', 'should return _rev');
    t.equal(obj.title, 'New title', 'should return title');

    teardownNock();
  });
});

test('db.insert insert and get id from database', (t) => {
  setupPostDoc3();
  let doc = { type: 'entry' };
  let db = new DbdbCouch(config);

  return db.insert(doc)

  .then((obj) => {
    t.equal(obj.id, 'doc3', 'should return new id');

    teardownNock();
  });
});

test('db.insert for updating existing document', (t) => {
  setupPostDoc1();
  let doc = { id: 'doc1', _rev: '2774761001', type: 'entry' };
  let db = new DbdbCouch(config);

  return db.insert(doc)

  .then((obj) => {
    t.equal(obj.id, 'doc1', 'should return existing id');
    t.equal(obj._rev, '2774761004', 'should return new _rev');

    teardownNock();
  });
});

test('db.insert exception for missing document object', (t) => {
  let db = new DbdbCouch(config);

  return db.insert()

  .catch((err) => {
    t.ok(err instanceof Error, 'should be Error');
  });
});

test('db.insert exception when connection fails', (t) => {
  setupPostDoc1();
  let doc = { id: 'doc1', type: 'entry' };
  let db = new DbdbCouch(config);
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'));

  return db.insert(doc)

  .catch((err) => {
    t.equal(err, 'Failure', 'should return connection err');

    db.connect.restore();
    teardownNock();
  });
});

// Tests -- update

test('db.update', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.update, 'function', 'should exist');
  t.end();
});

test('db.update update document', (t) => {
  setupGetDoc1();
  setupPostDoc1();
  let doc = {
    id: 'doc1',
    type: 'entry',
    title: 'A brand new title'
  };
  let db = new DbdbCouch(config);

  return db.update(doc)

  .then((obj) => {
    t.equal(obj.id, 'doc1', 'should return id');
    t.equal(obj.type, 'entry', 'should return type');
    t.equal(obj._rev, '2774761004', 'should return new _rev');
    t.equal(obj.title, 'A brand new title', 'should return title');

    teardownNock();
  });
});

test('db.update keep old createdAt', (t) => {
  setupGetDoc1();
  setupPostDoc1();
  let doc = {
    id: 'doc1',
    type: 'entry',
    createdAt: '2015-06-01'
  };
  let db = new DbdbCouch(config);

  return db.update(doc)

  .then((obj) => {
    t.equal(obj.createdAt, '2015-05-23', 'should return id');

    teardownNock();
  });
});

test('db.update update provided data only', (t) => {
  setupGetDoc1();
  setupPostDoc1();
  let doc = {
    id: 'doc1',
    title: 'Another brand new title',
    description: 'Described in detail'
  };
  let db = new DbdbCouch(config);

  return db.update(doc)

  .then((obj) => {
    t.equal(obj.title, 'Another brand new title', 'should return new title');
    t.equal(obj.description, 'Described in detail', 'should return new description');
    t.equal(obj.type, 'entry', 'should return old type');

    teardownNock();
  });
});

test('db.update underscored properties', (t) => {
  setupGetDoc1();
  setupPostDoc1();
  let doc = {
    id: 'doc1',
    _rev: '2883392',
    _internal: 'something'
  };
  let db = new DbdbCouch(config);

  return db.update(doc)

  .then((obj) => {
    t.equal(obj._rev, '2774761004', 'should return _rev');
    t.equal(typeof obj._internal, 'undefined', 'should not return other underscored');

    teardownNock();
  });
});

test('db.update exception for missing document object', (t) => {
  let db = new DbdbCouch(config);

  return db.update()

  .catch((err) => {
    t.ok(err instanceof Error, 'should be Error');
  });
});

test('db.update exception for missing id', (t) => {
  let doc = { type: 'entry' };
  let db = new DbdbCouch(config);

  return db.update(doc)

  .catch((err) => {
    t.ok(err instanceof Error, 'should be Error');
  });
});
