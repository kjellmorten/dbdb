'use strict';

const test = require('blue-tape');
const nock = require('nock');
const sinon = require('sinon');

const DbdbCouch = require('../lib/couchdb');

// Config for connections
let config = {
  url: 'http://database.fake',
  db: 'feednstatus'
};

// Helpers

function setupBulk() {
  nock('http://database.fake')
    .post('/feednstatus/_bulk_docs')
    .reply(201, [ { id: 'doc1', rev: '2774761004' }, { id: 'doc2', rev: '2774761005' } ]);
}

function teardownNock() {
  nock.cleanAll();
}

// Tests -- insert many

test('db.insertMany', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.insertMany, 'function', 'should exist');
  t.end();
});

test('db.insertMany new documents', (t) => {
  setupBulk();
  let docs = [
    { type: 'entry', title: 'First title' },
    { type: 'entry', title: 'Second title' }
  ];
  let db = new DbdbCouch(config);

  return db.insertMany(docs)

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should return array');
    t.equal(obj.length, 2, 'should return two items');
    t.equal(obj[0].id, 'doc1', 'should return first id');
    t.equal(obj[0]._rev, '2774761004', 'should return first _rev');
    t.equal(obj[0].type, 'entry', 'should return first type');
    t.equal(obj[0].title, 'First title', 'should return first title');
    t.equal(obj[1].id, 'doc2', 'should return second id');
    t.equal(obj[1]._rev, '2774761005', 'should return second _rev');
    t.equal(obj[1].type, 'entry', 'should return second type');
    t.equal(obj[1].title, 'Second title', 'should return second title');

    teardownNock();
  });
});

test('db.insertMany _error and _reason', (t) => {
  let docs = [ { type: 'entry' }, { type: 'entry' }];
  nock('http://database.fake')
    .post('/feednstatus/_bulk_docs')
    .reply(201, [ { id: 'doc1', rev: '2774761004' }, { id: 'doc2', error: 'conflict', reason: 'Some reason' } ]);
  let db = new DbdbCouch(config);

  return db.insertMany(docs)

  .then((ret) => {
    t.equal(typeof ret[0]._error, 'undefined', 'first _error');
    t.equal(typeof ret[0]._reason, 'undefined', 'first _reason');
    t.equal(ret[1]._error, 'conflict', 'second _error');
    t.equal(ret[1]._reason, 'Some reason', 'second _reason');

    teardownNock();
  });
});

test('db.insertMany exception for missing docs', (t) => {
  let db = new DbdbCouch(config);

  return db.insertMany()

  .catch((err) => {
    t.ok(err instanceof Error, 'should be an Error');
  });
});

test('db.insertMany no items', (t) => {
  let db = new DbdbCouch(config);

  return db.insertMany([])

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should return array');
    t.equal(obj.length, 0, 'should return empty array');
  });
});

test('db.insertMany should throw exception when connection fails', (t) => {
  let db = new DbdbCouch(config);
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'));

  return db.insertMany([ { type: 'entry', title: 'Title' } ])

  .catch((err) => {
    t.ok(err instanceof Error, 'throws error');
    t.ok(err.message.startsWith('Could not insert documents'), 'error message from insertMany: ' + err.message);

    db.connect.restore();
  });
});

test('db.insertMany exception on bulk error', (t) => {
  nock('http://database.fake')
    .post('/feednstatus/_bulk_docs')
    .reply(500);
  let db = new DbdbCouch(config);

  return db.insertMany([ { type: 'entry', title: 'Title' } ])

  .catch((err) => {
    t.ok(err instanceof Error, 'should be Error');

    teardownNock();
  });
});

// Tests -- delete many

test('db.deleteMany', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.deleteMany, 'function', 'should exist');
  t.end();
});

test('db.deleteMany mark as deleted', (t) => {
  let docs = [
    { id: 'ent1', type: 'entry', title: 'First title' },
    { id: 'ent2', type: 'entry', title: 'Second title' }
  ];
  let db = new DbdbCouch(config);
  sinon.stub(db, 'insertMany').returns(Promise.resolve([]));

  return db.deleteMany(docs)

  .then(() => {
    t.equal(db.insertMany.callCount, 1, 'should go trough db.insertMany');
    let json = db.insertMany.args[0][0];
    t.ok(Array.isArray(json), 'should call with array');
    t.equal(json.length, 2, 'should call with two items');
    t.equal(json[0]._deleted, true, 'should set _deleted on first');
    t.equal(json[1]._deleted, true, 'should set _deleted on second');

    db.insertMany.restore();
  });
});

test('db.deleteMany response', (t) => {
  let ret = [];
  let db = new DbdbCouch(config);
  sinon.stub(db, 'insertMany').returns(Promise.resolve(ret));

  return db.deleteMany([])

  .then((json) => {
    t.equal(json, ret, 'should be response from insertMany');

    db.insertMany.restore();
  });
});
