import test from 'ava'
import sinon from 'sinon'
import {setupNock, teardownNock} from './helpers/http'

import DbdbCouch from '../lib/couchdb'

// Config for connections
const getConfig = (nock) => ({url: (nock) ? nock.basePath : 'http://test.url', db: 'feednstatus'})

// Helpers

function setupGetDoc1 (nockScope) {
  return setupNock(nockScope)
    .get('/feednstatus/doc1')
    .reply(200, {
      _id: 'doc1',
      _rev: '2774761001',
      type: 'entry',
      title: 'The title',
      createdAt: '2015-05-23'
    })
}

function setupPostDoc1 (nockScope) {
  return setupNock(nockScope)
    .post('/feednstatus', { _id: 'doc1', _rev: '2774761001' })
    .reply(201, {ok: true, id: 'doc1', rev: '2774761004'})
}

function setupPostDoc2 (nockScope) {
  return setupNock(nockScope)
    .post('/feednstatus', { _id: 'doc2' })
    .reply(201, {ok: true, id: 'doc2', rev: '2774761002'})
}

function setupPostDoc3 (nockScope) {
  return setupNock(nockScope)
    .post('/feednstatus')
    .reply(201, {ok: true, id: 'doc3', rev: '2774761014'})
}

function setupPostWithConflict (nockScope) {
  return setupNock(nockScope)
    .post('/feednstatus', { _id: 'doc4' })
    .reply(409, {error: 'conflict', reason: 'Document update conflict.'})
}

function setupPostWithError (nockScope) {
  return setupNock(nockScope)
    .post('/feednstatus', { _id: 'doc5' })
    .reply(409, {error: 'other', reason: 'Other error.'})
}

// Tests -- insert document

test('db.insert should exist', (t) => {
  const db = new DbdbCouch(getConfig())

  t.is(typeof db.insert, 'function')
})

test('db.insert should insert new document', (t) => {
  const nock = setupPostDoc2()
  let doc = {
    id: 'doc2',
    type: 'entry',
    title: 'New title'
  }
  const db = new DbdbCouch(getConfig(nock))

  return db.insert(doc)

  .then((obj) => {
    t.is(obj.id, 'doc2')
    t.is(obj.type, 'entry')
    t.is(obj._rev, '2774761002')
    t.is(obj.title, 'New title')

    teardownNock(nock)
  })
})

test('db.insert should insert and get id from database', (t) => {
  const nock = setupPostDoc3()
  const doc = { type: 'entry' }
  const db = new DbdbCouch(getConfig(nock))

  return db.insert(doc)

  .then((obj) => {
    t.is(obj.id, 'doc3')

    teardownNock(nock)
  })
})

test('db.insert should updating existing document', (t) => {
  const nock = setupPostDoc1()
  const doc = { id: 'doc1', _rev: '2774761001', type: 'entry' }
  const db = new DbdbCouch(getConfig(nock))

  return db.insert(doc)

  .then((obj) => {
    t.is(obj.id, 'doc1')
    t.is(obj._rev, '2774761004')

    teardownNock(nock)
  })
})

test('db.insert should reject for missing document object', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.insert()

  .catch((err) => {
    t.true(err instanceof Error)
  })
})

test('db.insert should reject when connection fails', (t) => {
  t.plan(1)
  const nock = setupPostDoc1()
  const doc = { id: 'doc1', type: 'entry', _rev: '2774761001' }
  const db = new DbdbCouch(getConfig(nock))
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'))

  return db.insert(doc)

  .catch((err) => {
    t.is(err, 'Failure')

    db.connect.restore()
    teardownNock(nock)
  })
})

test('db.insert should reject on insert conflict', (t) => {
  t.plan(2)
  const nock = setupPostWithConflict()
  const doc = { id: 'doc4' }
  const db = new DbdbCouch(getConfig(nock))

  return db.insert(doc)

  .catch((err) => {
    t.truthy(err)
    t.is(err.name, 'ConflictError')

    teardownNock(nock)
  })
})

test('db.insert should reject on other insert error', (t) => {
  t.plan(2)
  const nock = setupPostWithError()
  const doc = { id: 'doc5' }
  const db = new DbdbCouch(getConfig(nock))

  return db.insert(doc)

  .catch((err) => {
    t.truthy(err)
    t.is(err.name, 'Error')

    teardownNock(nock)
  })
})

// Tests -- update

test('db.update should exist', (t) => {
  let db = new DbdbCouch(getConfig())

  t.is(typeof db.update, 'function')
})

test('db.update should update document', (t) => {
  const nock = setupGetDoc1()
  setupPostDoc1(nock)
  const doc = {
    id: 'doc1',
    type: 'entry',
    title: 'A brand new title'
  }
  const db = new DbdbCouch(getConfig(nock))

  return db.update(doc)

  .then((obj) => {
    t.is(obj.id, 'doc1')
    t.is(obj.type, 'entry')
    t.is(obj._rev, '2774761004')
    t.is(obj.title, 'A brand new title')

    teardownNock(nock)
  })
})

test('db.update should keep old createdAt', (t) => {
  const nock = setupGetDoc1()
  setupPostDoc1(nock)
  const doc = {
    id: 'doc1',
    type: 'entry',
    createdAt: '2015-06-01'
  }
  const db = new DbdbCouch(getConfig(nock))

  return db.update(doc)

  .then((obj) => {
    t.is(obj.createdAt, '2015-05-23')

    teardownNock(nock)
  })
})

test('db.update should update provided data only', (t) => {
  const nock = setupGetDoc1()
  setupPostDoc1(nock)
  const doc = {
    id: 'doc1',
    title: 'Another brand new title',
    description: 'Described in detail'
  }
  const db = new DbdbCouch(getConfig(nock))

  return db.update(doc)

  .then((obj) => {
    t.is(obj.title, 'Another brand new title')
    t.is(obj.description, 'Described in detail')
    t.is(obj.type, 'entry')

    teardownNock(nock)
  })
})

test('db.update should return _rev and no other underscored properties', (t) => {
  const nock = setupGetDoc1()
  setupPostDoc1(nock)
  const doc = {
    id: 'doc1',
    _rev: '2883392',
    _internal: 'something'
  }
  const db = new DbdbCouch(getConfig(nock))

  return db.update(doc)

  .then((obj) => {
    t.is(obj._rev, '2774761004')
    t.is(typeof obj._internal, 'undefined')

    teardownNock(nock)
  })
})

test('db.update should throw for missing document object', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.update()

  .catch((err) => {
    t.true(err instanceof Error)
  })
})

test('db.update should throw for missing id', (t) => {
  const doc = { type: 'entry' }
  const db = new DbdbCouch(getConfig())

  return db.update(doc)

  .catch((err) => {
    t.true(err instanceof Error)
  })
})
