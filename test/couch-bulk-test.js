import test from 'ava'
import sinon from 'sinon'
import {setupNock, teardownNock} from './helpers/http'

import DbdbCouch from '../lib/couchdb'

// Config for connections
const getConfig = (nock) => ({url: (nock) ? nock.basePath : 'http://test.url', db: 'feednstatus'})

// Helpers

function setupBulk () {
  return setupNock()
    .post('/feednstatus/_bulk_docs')
    .reply(201, [ { id: 'doc1', rev: '2774761004' }, { id: 'doc2', rev: '2774761005' } ])
}

// Tests -- insert many

test('db.insertMany should exist', (t) => {
  const db = new DbdbCouch(getConfig())

  t.is(typeof db.insertMany, 'function')
})

test('db.insertMany should insert new documents', (t) => {
  const nock = setupBulk()
  const docs = [
    { type: 'entry', title: 'First title' },
    { type: 'entry', title: 'Second title' }
  ]
  const db = new DbdbCouch(getConfig(nock))

  return db.insertMany(docs)

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 2)
    t.is(obj[0].id, 'doc1')
    t.is(obj[0]._rev, '2774761004')
    t.is(obj[0].type, 'entry')
    t.is(obj[0].title, 'First title')
    t.is(obj[1].id, 'doc2')
    t.is(obj[1]._rev, '2774761005')
    t.is(obj[1].type, 'entry')
    t.is(obj[1].title, 'Second title')

    teardownNock(nock)
  })
})

test('db.insertMany should return _error and _reason', (t) => {
  const docs = [{ type: 'entry' }, { type: 'entry' }]
  const nock = setupNock()
    .post('/feednstatus/_bulk_docs')
    .reply(201, [ { id: 'doc1', rev: '2774761004' }, { id: 'doc2', error: 'conflict', reason: 'Some reason' } ])
  const db = new DbdbCouch(getConfig(nock))

  return db.insertMany(docs)

  .then((ret) => {
    t.is(typeof ret[0]._error, 'undefined')
    t.is(typeof ret[0]._reason, 'undefined')
    t.is(ret[1]._error, 'conflict')
    t.is(ret[1]._reason, 'Some reason')

    teardownNock(nock)
  })
})

test('db.insertMany should throw for missing docs', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.insertMany()

  .catch((err) => {
    t.true(err instanceof Error)
  })
})

test('db.insertMany should return empty array', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.insertMany([])

  .then((obj) => {
    t.true(Array.isArray(obj))
    t.is(obj.length, 0)
  })
})

test('db.insertMany should throw exception when connection fails', (t) => {
  const db = new DbdbCouch(getConfig())
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'))

  return db.insertMany([ { type: 'entry', title: 'Title' } ])

  .catch((err) => {
    t.true(err instanceof Error)
    t.true(err.message.startsWith('Could not insert documents'))

    db.connect.restore()
  })
})

test('db.insertMany should throw on bulk error', (t) => {
  const nock = setupNock()
    .post('/feednstatus/_bulk_docs')
    .reply(500)
  const db = new DbdbCouch(getConfig(nock))

  return db.insertMany([ { type: 'entry', title: 'Title' } ])

  .catch((err) => {
    t.true(err instanceof Error)

    teardownNock(nock)
  })
})

// Tests -- delete many

test('db.deleteMany should exist', (t) => {
  const db = new DbdbCouch(getConfig())

  t.is(typeof db.deleteMany, 'function')
})

test('db.deleteMany should mark as deleted', (t) => {
  const docs = [
    { id: 'ent1', type: 'entry', title: 'First title' },
    { id: 'ent2', type: 'entry', title: 'Second title' }
  ]
  const db = new DbdbCouch(getConfig())
  sinon.stub(db, 'insertMany').returns(Promise.resolve([]))

  return db.deleteMany(docs)

  .then(() => {
    t.is(db.insertMany.callCount, 1)
    let json = db.insertMany.args[0][0]
    t.true(Array.isArray(json))
    t.is(json.length, 2)
    t.is(json[0]._deleted, true)
    t.is(json[1]._deleted, true)

    db.insertMany.restore()
  })
})

test('db.deleteMany should return input', (t) => {
  const ret = []
  const db = new DbdbCouch(getConfig())
  sinon.stub(db, 'insertMany').returns(Promise.resolve(ret))

  return db.deleteMany([])

  .then((json) => {
    t.is(json, ret)

    db.insertMany.restore()
  })
})
