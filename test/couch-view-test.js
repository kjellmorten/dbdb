import test from 'ava'
import sinon from 'sinon'
import {setupNock, teardownNock} from './helpers/http'
import getConfig from './helpers/getConfig'

import DbdbCouch from '../lib/couchdb'

// Helpers

function setupFnsSources (desc) {
  return setupNock()
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: (desc) ? 'true' : 'false' })
      .reply(200, { rows: [
        { id: 'src1', key: [ '2015-05-23T00:00:00.000Z', 'src1' ],
        doc: { _id: 'src1', type: 'source', name: 'Src 1', url: 'http://source1.com' } },
        { id: 'src2', key: [ '2015-05-24T00:00:00.000Z', 'src2' ],
        doc: { _id: 'src2', type: 'source', name: 'Src 2', url: 'http://source2.com' } }
      ] })
}

function setupFnsSourcesPaged (skip) {
  const query = { include_docs: 'true', descending: 'false', limit: '1' }
  if (skip) {
    query.skip = skip.toString()
  }
  return setupNock()
    .get('/feednstatus/_design/fns/_view/sources')
    .query(query)
      .reply(200, { rows: [
        { id: 'src2', key: [ '2015-05-24T00:00:00.000Z', 'src2' ],
        doc: { _id: 'src2', type: 'source', name: 'Src 2', url: 'http://source2.com' } }
      ] })
}

function setupFnsSourcesAfterKey () {
  return setupNock()
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false', limit: '1',
      startkey: JSON.stringify([ '2015-05-24T00:00:00.000Z', 'src2' ]) })
      .reply(200, { rows: [
        { id: 'src2', key: [ '2015-05-24T00:00:00.000Z', 'src2' ],
        doc: { _id: 'src2', type: 'source', name: 'Src 2', url: 'http://source2.com' } }
      ] })
}

function setupFnsEntriesByFeed () {
  let ent1 = { id: 'ent1', key: [ 'acc2', 'feed1', '2015-05-23T00:00:00.000Z', 'ent1' ],
    doc: { _id: 'ent1', type: 'entry', title: 'Entry 1', url: 'http://source2.com/ent1' } }
  let ent2 = { id: 'ent2', key: [ 'acc2', 'feed2', '2015-05-24T00:00:00.000Z', 'ent2' ],
      doc: { _id: 'ent2', type: 'entry', title: 'Entry 2', url: 'http://source2.com/ent2' } }

  return setupNock()
    // Not descending
    .get('/feednstatus/_design/fns/_view/entries_by_feed')
    .query({ include_docs: 'true', descending: 'false', inclusive_end: 'true',
      startkey: JSON.stringify(['acc2']), endkey: JSON.stringify(['acc2', {}])})
      .reply(200, { rows: [ent1, ent2] })
    // Desscending
    .get('/feednstatus/_design/fns/_view/entries_by_feed')
    .query({ include_docs: 'true', descending: 'true', inclusive_end: 'true',
      startkey: JSON.stringify(['acc2', {}]), endkey: JSON.stringify(['acc2'])})
      .reply(200, { rows: [ent2, ent1] })
    // With two levels
    .get('/feednstatus/_design/fns/_view/entries_by_feed')
    .query({ include_docs: 'true', descending: 'false', inclusive_end: 'true',
      startkey: JSON.stringify(['acc2', 'feed2']), endkey: JSON.stringify(['acc2', 'feed2', {}])})
      .reply(200, { rows: [ent2] })
    .get('/feednstatus/_design/fns/_view/entries_by_feed')
    .query({ include_docs: 'true', descending: 'false', inclusive_end: 'true',
      startkey: JSON.stringify(['acc2', 'feed2', '2015-05-24T00:00:00.000Z', 'ent2']),
      endkey: JSON.stringify(['acc2', 'feed2', {}])})
      .reply(200, { rows: [ent2] })
    .get('/feednstatus/_design/fns/_view/entries_by_feed')
    .query({ include_docs: 'true', descending: 'true', inclusive_end: 'true',
      startkey: JSON.stringify(['acc2', 'feed2', '2015-05-24T00:00:00.000Z', 'ent2']),
      endkey: JSON.stringify(['acc2', 'feed2'])})
      .reply(200, { rows: [ent2] })
}

// Tests -- view

test('db.getView should exist', (t) => {
  const db = new DbdbCouch(getConfig())

  t.is(typeof db.getView, 'function')
})

test('db.getView should return array of items', (t) => {
  const nock = setupFnsSources()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources')

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 2)
    t.is(typeof obj[0], 'object')
    t.is(obj[0].id, 'src1')
    t.is(obj[0].type, 'source')
    t.is(obj[0].name, 'Src 1')
    t.is(obj[0].url, 'http://source1.com')

    teardownNock()
  })
})

test('db.getView should return keys', (t) => {
  const nock = setupFnsSources()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources')

  .then((obj) => {
    t.deepEqual(obj[0]._key, [ '2015-05-23T00:00:00.000Z', 'src1' ])
    t.deepEqual(obj[1]._key, [ '2015-05-24T00:00:00.000Z', 'src2' ])

    teardownNock()
  })
})

test('db.getView should reverse order', (t) => {
  const nock = setupFnsSources(true)
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources', {desc: true})

  .then((obj) => {
    // Getting results here means we got results in reverse order.
    // Otherwise, we would get a 404 in this test setting
    t.is(obj.length, 2)

    teardownNock()
  })
})

test('db.getView should reverse order with old signature', (t) => {
  const nock = setupFnsSources(true)
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources', true)

  .then((obj) => {
    // Getting results here means we got results in reverse order.
    // Otherwise, we would get a 404 in this test setting
    t.is(obj.length, 2)

    teardownNock()
  })
})

test('db.getView should return paged view through options', (t) => {
  const nock = setupFnsSourcesPaged()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources', {max: 1})

  .then((obj) => {
    t.is(obj.length, 1)
    t.is(obj[0].id, 'src2')

    teardownNock()
  })
})

test('db.getView should return second page through options', (t) => {
  const nock = setupFnsSourcesPaged(1)
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources', {max: 1, first: 1})

  .then((obj) => {
    // Getting results here means we got the second page.
    // Otherwise, we would get a 404 in this test setting
    t.is(obj.length, 1)

    teardownNock()
  })
})

test('db.getView should start with specific key', (t) => {
  const nock = setupFnsSourcesAfterKey()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources', {firstKey: ['2015-05-24T00:00:00.000Z', 'src2'], max: 1})

  .then((obj) => {
    t.is(obj.length, 1)
    t.is(obj[0].id, 'src2')

    teardownNock()
  })
})

test('db.getView should filter results by key', (t) => {
  const nock = setupFnsEntriesByFeed()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:entries_by_feed', {filter: 'acc2'})

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 2)
    t.is(obj[0].id, 'ent1')
    t.is(obj[1].id, 'ent2')

    teardownNock()
  })
})

test('db.getView should filter results by key descending', (t) => {
  const nock = setupFnsEntriesByFeed()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:entries_by_feed', {filter: 'acc2', desc: true})

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 2)
    t.is(obj[0].id, 'ent2')
    t.is(obj[1].id, 'ent1')

    teardownNock()
  })
})

test('db.getView should filter results by two level key', (t) => {
  const nock = setupFnsEntriesByFeed()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:entries_by_feed', {filter: 'acc2/feed2'})

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 1)
    t.is(obj[0].id, 'ent2')

    teardownNock()
  })
})

test('db.getView should filter and start with specific key', (t) => {
  const nock = setupFnsEntriesByFeed()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:entries_by_feed',
    {filter: 'acc2/feed2', firstKey: ['2015-05-24T00:00:00.000Z', 'ent2']})

  .then((obj) => {
    t.is(obj.length, 1)
    t.is(obj[0].id, 'ent2')

    teardownNock()
  })
})

test('db.getView should filter and start with specific key descending', (t) => {
  const nock = setupFnsEntriesByFeed()
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:entries_by_feed',
    {filter: 'acc2/feed2', firstKey: ['2015-05-24T00:00:00.000Z', 'ent2'], desc: true})

  .then((obj) => {
    t.is(obj.length, 1)
    t.is(obj[0].id, 'ent2')

    teardownNock()
  })
})

test('db.getView should return no match', (t) => {
  const nock = setupNock()
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false' })
    .reply(200, {})
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources')

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 0)

    teardownNock()
  })
})

test('db.getView should not return rows without docs', (t) => {
  const nock = setupNock()
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false' })
    .reply(200, { rows: [
      { id: 'src1' },
      { id: 'src2', doc: { _id: 'src2', type: 'source' } }
    ] })
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources')

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 1)
    t.is(obj[0].id, 'src2')

    teardownNock()
  })
})

test('db.getView should use value when present', (t) => {
  const nock = setupNock()
    .get('/feednstatus/_design/fns/_view/sources')
    .query({ include_docs: 'true', descending: 'false' })
    .reply(200, { rows: [
      { id: 'src1', value: { _id: 'src1', type: 'source' }, doc: null }
    ] })
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources')

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 1)
    t.is(obj[0].id, 'src1')

    teardownNock()
  })
})

test('db.getView should not alter options object', (t) => {
  const nock = setupFnsSourcesPaged()
  const db = new DbdbCouch(getConfig(nock))
  const options = {max: 1}
  Object.freeze(options)

  return db.getView('fns:sources', options)

  .then((obj) => {
    t.pass()

    teardownNock()
  })
})

test('db.getView should throw on database error', (t) => {
  const nock = setupNock()
    .get('/feednstatus/_design/fns/_view/sources')
    .reply(404)
  const db = new DbdbCouch(getConfig(nock))

  return db.getView('fns:sources')

  .catch((err) => {
    t.truthy(err instanceof Error)

    teardownNock()
  })
})

test('db.getView should throw on connection failure', (t) => {
  const db = new DbdbCouch(getConfig())
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'))

  return db.getView('fns:sources')

  .then(t.fail, (err) => {
    t.is(err, 'Failure')

    db.connect.restore()
  })
})
