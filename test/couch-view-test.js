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

function setupFnsSources(desc) {
  nock('http://database.fake')
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: (desc) ? 'true' : 'false' })
    .reply(200, { rows: [
      { id: 'src1', key: [ '2015-05-23T00:00:00.000Z', 'src1' ],
      doc: { _id: 'src1', type: 'source', name: 'Src 1', url: 'http://source1.com' } },
      { id: 'src2', key: [ '2015-05-24T00:00:00.000Z', 'src2' ],
      doc: { _id: 'src2', type: 'source', name: 'Src 2', url: 'http://source2.com' } }
    ] });
}

function setupFnsSourcesPaged(skip) {
  skip = skip || 0;
  nock('http://database.fake')
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false', limit: '1', skip: skip.toString() })
    .reply(200, { rows: [
      { id: 'src2', key: [ '2015-05-24T00:00:00.000Z', 'src2' ],
      doc: { _id: 'src2', type: 'source', name: 'Src 2', url: 'http://source2.com' } }
    ] });
}

function setupFnsSourcesAfterKey() {
  nock('http://database.fake')
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false', limit: '2',
      startkey: JSON.stringify([ '2015-05-24T00:00:00.000Z', 'src2' ]) })
    .reply(200, { rows: [
      { id: 'src2', key: [ '2015-05-24T00:00:00.000Z', 'src2' ],
      doc: { _id: 'src2', type: 'source', name: 'Src 2', url: 'http://source2.com' } },
      { id: 'src1', key: [ '2015-05-23T00:00:00.000Z', 'src1' ],
      doc: { _id: 'src1', type: 'source', name: 'Src 1', url: 'http://source1.com' } }
    ] });
}

function setupFnsEntriesBySource() {
  let ent1 = { id: 'ent1', key: [ 'src2', '2015-05-23T00:00:00.000Z' ],
    doc: { _id: 'ent1', type: 'entry', title: 'Entry 1', url: 'http://source2.com/ent1' } };
  let ent2 = { id: 'ent2', key: [ 'src2', '2015-05-24T00:00:00.000Z' ],
      doc: { _id: 'ent2', type: 'entry', title: 'Entry 2', url: 'http://source2.com/ent2' } };
  nock('http://database.fake')
    // Not descending
    .get('/feednstatus/_design/fns/_view/entries_by_source')
    .query({ include_docs: 'true', descending: 'false', inclusive_end: 'true',
      startkey: JSON.stringify(['src2']), endkey: JSON.stringify(['src2', {}])})
    .reply(200, { rows: [ent1, ent2] })
    // Desscending
    .get('/feednstatus/_design/fns/_view/entries_by_source')
    .query({ include_docs: 'true', descending: 'true', inclusive_end: 'true',
      startkey: JSON.stringify(['src2', {}]), endkey: JSON.stringify(['src2'])})
    .reply(200, { rows: [ent2, ent1] });
}

function teardownNock() {
  nock.cleanAll();
}

// Tests -- view

test('db.getView', (t) => {
  let db = new DbdbCouch(config);

  t.equal(typeof db.getView, 'function', 'should exist');
  t.end();
});

test('db.getView return', (t) => {
  setupFnsSources();
  let db = new DbdbCouch(config);

  return db.getView('fns:sources')

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should be array');
    t.equal(obj.length, 2, 'should have two items');
    t.equal(typeof obj[0], 'object', 'should be objects');
    t.equal(obj[0].id, 'src1', 'should have id');
    t.equal(obj[0].type, 'source', 'should have type');
    t.equal(obj[0].name, 'Src 1', 'should have name');
    t.equal(obj[0].url, 'http://source1.com', 'should have url');

    teardownNock();
  });
});

test('db.getView keys', (t) => {
  setupFnsSources();
  let db = new DbdbCouch(config);

  return db.getView('fns:sources')

  .then((obj) => {
    t.deepEqual(obj[0]._key, [ '2015-05-23T00:00:00.000Z', 'src1' ], 'should include first key');
    t.deepEqual(obj[1]._key, [ '2015-05-24T00:00:00.000Z', 'src2' ], 'should include second key');

    teardownNock();
  });
});

test('db.getView old signature', (t) => {
  setupFnsSources();
  let db = new DbdbCouch(config);

  return db.getView('fns', 'sources')

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should be array');
    t.equal(obj.length, 2, 'should have two items');
    t.equal(obj[0].id, 'src1', 'should have id');

    teardownNock();
  });
});

test('db.getView reverse order', (t) => {
  setupFnsSources(true);
  let db = new DbdbCouch(config);

  return db.getView('fns:sources', true)

  .then((obj) => {
    // The mere fact that we're getting results means
    // the db.getView asked for a reverse order.
    // Otherwise, we would get a 404 in this test setting
    t.equal(obj.length, 2, 'should return reversed');

    teardownNock();
  });
});

test('db.getView paged view', (t) => {
  setupFnsSourcesPaged();
  let db = new DbdbCouch(config);

  return db.getView('fns:sources', false, {}, 1)

  .then((obj) => {
    t.equal(obj.length, 1, 'should have one item');
    t.equal(obj[0].id, 'src2', 'should have right id');

    teardownNock();
  });
});

test('db.getView second page', (t) => {
  setupFnsSourcesPaged(1);
  let db = new DbdbCouch(config);

  return db.getView('fns:sources', false, {}, 1, 1)

  .then((obj) => {
    // Again, results here means the second page.
    // Otherwise, we would get a 404 in this test setting
    t.equal(obj.length, 1, 'should return second page');

    teardownNock();
  });
});

test('db.getView paged view through options', (t) => {
  setupFnsSourcesPaged();
  let db = new DbdbCouch(config);

  return db.getView('fns:sources', false, {pageSize: 1})

  .then((obj) => {
    t.equal(obj.length, 1, 'should have one item');
    t.equal(obj[0].id, 'src2', 'should have right id');

    teardownNock();
  });
});

test('db.getView second page through options', (t) => {
  setupFnsSourcesPaged(1);
  let db = new DbdbCouch(config);

  return db.getView('fns:sources', false, {pageSize: 1, pageStart: 1})

  .then((obj) => {
    // Again, results here means the second page.
    // Otherwise, we would get a 404 in this test setting
    t.equal(obj.length, 1, 'should return second page');

    teardownNock();
  });
});

test('db.getView start after specific key', (t) => {
  setupFnsSourcesAfterKey();
  let db = new DbdbCouch(config);

  return db.getView('fns:sources', false, {startAfter: ['2015-05-24T00:00:00.000Z', 'src2']}, 1)

  .then((obj) => {
    t.equal(obj.length, 1, 'should return one item');
    t.equal(obj[0].id, 'src1', 'shoudl have right id');

    teardownNock();
  });
});

test('db.getView no match', (t) => {
  nock('http://database.fake')
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false' })
    .reply(200, {});
  let db = new DbdbCouch(config);

  return db.getView('fns:sources')

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should return array');
    t.equal(obj.length, 0, 'should return no items');

    teardownNock();
  });
});

test('db.getView rows without docs', (t) => {
  nock('http://database.fake')
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false' })
    .reply(200, { rows: [
      { id: 'src1' },
      { id: 'src2', doc: { _id: 'src2', type: 'source' } }
    ] });
  let db = new DbdbCouch(config);

  return db.getView('fns:sources')

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should return array');
    t.equal(obj.length, 1, 'should have only one item');
    t.equal(obj[0].id, 'src2', 'should only have row with doc');

    teardownNock();
  });
});

test('db.getView exception on database error', (t) => {
  nock('http://database.fake')
    .get('/feednstatus/_design/fns/_view/sources')
    .reply(404);
  let db = new DbdbCouch(config);

  return db.getView('fns:sources')

  .catch((err) => {
    t.ok(err instanceof Error, 'should be Error');

    teardownNock();
  });
});

test('db.getView exception on connection failure', (t) => {
  let db = new DbdbCouch(config);
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'));

  return db.getView('fns:sources')

  .then(t.fail, (err) => {
    t.equal(err, 'Failure', 'should be connection error');

    db.connect.restore();
  });
});

test('db.getView filter', (t) => {
  setupFnsEntriesBySource();
  let db = new DbdbCouch(config);

  return db.getView('fns:entries_by_source', false, {filter: 'src2'})

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should be array');
    t.equal(obj.length, 2, 'should have two items');
    t.equal(obj[0].id, 'ent1', 'should get first first');
    t.equal(obj[1].id, 'ent2', 'should get second last');

    teardownNock();
  });
});

test('db.getView filter descending', (t) => {
  setupFnsEntriesBySource();
  let db = new DbdbCouch(config);

  return db.getView('fns:entries_by_source', true, {filter: 'src2'})

  .then((obj) => {
    t.ok(Array.isArray(obj), 'should be array');
    t.equal(obj.length, 2, 'should have two items');
    t.equal(obj[0].id, 'ent2', 'should get second first');
    t.equal(obj[1].id, 'ent1', 'should get first last');

    teardownNock();
  });
});
