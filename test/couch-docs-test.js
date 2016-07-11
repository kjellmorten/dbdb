'use strict'

import test from 'ava'
import nock from 'nock'
import sinon from 'sinon'

import DbdbCouch from '../lib/couchdb'

// Config for connections
const config = {
  url: 'http://database.fake',
  db: 'feednstatus'
}

// Helpers

function setupGetDoc1 () {
  nock('http://database.fake')
    .get('/feednstatus/doc1')
    .reply(200, {
      _id: 'doc1',
      _rev: '2774761001',
      type: 'entry',
      title: 'The title',
      createdAt: '2015-05-23'
    })
}

function setupPostDoc1 () {
  nock('http://database.fake')
    .post('/feednstatus', { _id: 'doc1', _rev: '2774761001' })
    .reply(201, {
      ok: true,
      id: 'doc1',
      rev: '2774761004'
    })
}

function setupPostDoc2 () {
  nock('http://database.fake')
    .post('/feednstatus', { _id: 'doc2' })
    .reply(201, {
      ok: true,
      id: 'doc2',
      rev: '2774761002'
    })
}

function setupPostDoc3 () {
  nock('http://database.fake')
    .post('/feednstatus')
    .reply(201, {
      ok: true,
      id: 'doc3',
      rev: '2774761003'
    })
}

function teardownNock () {
  nock.cleanAll()
}

// Tests -- get document

test('db.get', (t) => {
  const db = new DbdbCouch(config)

  t.is(typeof db.get, 'function')
})

test.serial('db.get should return doc', (t) => {
  setupGetDoc1()
  const db = new DbdbCouch(config)

  return db.get('doc1')

  .then((obj) => {
    t.is(typeof obj, 'object')
    t.is(obj.id, 'doc1')
    t.is(obj.type, 'entry')
    t.is(obj.title, 'The title')

    teardownNock()
  })
})

test('db.get should throw for non-existing document', (t) => {
  const db = new DbdbCouch(config)

  return db.get('doc2')

  .catch((err) => {
    t.true(err instanceof Error)
    t.is(typeof err.message, 'string')
    t.is(err.name, 'NotFoundError')
  })
})

test('db.get should throw for missing docid', (t) => {
  const db = new DbdbCouch(config)

  return db.get()

  .catch((err) => {
    t.true(err instanceof Error)
  })
})

test('db.get should throw when connection fails', (t) => {
  setupGetDoc1()
  const db = new DbdbCouch(config)
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'))

  return db.get('doc1')

  .catch((err) => {
    t.is(err, 'Failure')

    db.connect.restore()
    teardownNock()
  })
})

// Tests -- insert document

test('db.insert should exist', (t) => {
  const db = new DbdbCouch(config)

  t.is(typeof db.insert, 'function')
})

test.serial('db.insert should insert new document', (t) => {
  setupPostDoc2()
  let doc = {
    id: 'doc2',
    type: 'entry',
    title: 'New title'
  }
  const db = new DbdbCouch(config)

  return db.insert(doc)

  .then((obj) => {
    t.is(obj.id, 'doc2')
    t.is(obj.type, 'entry')
    t.is(obj._rev, '2774761002')
    t.is(obj.title, 'New title')

    teardownNock()
  })
})

test.serial('db.insert should insert and get id from database', (t) => {
  setupPostDoc3()
  const doc = { type: 'entry' }
  const db = new DbdbCouch(config)

  return db.insert(doc)

  .then((obj) => {
    t.is(obj.id, 'doc3')

    teardownNock()
  })
})

test.serial('db.insert should updating existing document', (t) => {
  setupPostDoc1()
  const doc = { id: 'doc1', _rev: '2774761001', type: 'entry' }
  const db = new DbdbCouch(config)

  return db.insert(doc)

  .then((obj) => {
    t.is(obj.id, 'doc1')
    t.is(obj._rev, '2774761004')

    teardownNock()
  })
})

test('db.insert should throw for missing document object', (t) => {
  const db = new DbdbCouch(config)

  return db.insert()

  .catch((err) => {
    t.true(err instanceof Error)
  })
})

test('db.insert should throw when connection fails', (t) => {
  setupPostDoc1()
  const doc = { id: 'doc1', type: 'entry' }
  const db = new DbdbCouch(config)
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'))

  return db.insert(doc)

  .catch((err) => {
    t.is(err, 'Failure')

    db.connect.restore()
    teardownNock()
  })
})

// Tests -- update

test('db.update should exist', (t) => {
  let db = new DbdbCouch(config)

  t.is(typeof db.update, 'function')
})

test.serial('db.update should update document', (t) => {
  setupGetDoc1()
  setupPostDoc1()
  const doc = {
    id: 'doc1',
    type: 'entry',
    title: 'A brand new title'
  }
  const db = new DbdbCouch(config)

  return db.update(doc)

  .then((obj) => {
    t.is(obj.id, 'doc1')
    t.is(obj.type, 'entry')
    t.is(obj._rev, '2774761004')
    t.is(obj.title, 'A brand new title')

    teardownNock()
  })
})

test.serial('db.update should keep old createdAt', (t) => {
  setupGetDoc1()
  setupPostDoc1()
  const doc = {
    id: 'doc1',
    type: 'entry',
    createdAt: '2015-06-01'
  }
  const db = new DbdbCouch(config)

  return db.update(doc)

  .then((obj) => {
    t.is(obj.createdAt, '2015-05-23')

    teardownNock()
  })
})

test.serial('db.update should update provided data only', (t) => {
  setupGetDoc1()
  setupPostDoc1()
  const doc = {
    id: 'doc1',
    title: 'Another brand new title',
    description: 'Described in detail'
  }
  const db = new DbdbCouch(config)

  return db.update(doc)

  .then((obj) => {
    t.is(obj.title, 'Another brand new title')
    t.is(obj.description, 'Described in detail')
    t.is(obj.type, 'entry')

    teardownNock()
  })
})

test.serial('db.update should return _rev and no other underscored properties', (t) => {
  setupGetDoc1()
  setupPostDoc1()
  const doc = {
    id: 'doc1',
    _rev: '2883392',
    _internal: 'something'
  }
  const db = new DbdbCouch(config)

  return db.update(doc)

  .then((obj) => {
    t.is(obj._rev, '2774761004')
    t.is(typeof obj._internal, 'undefined')

    teardownNock()
  })
})

test('db.update should throw for missing document object', (t) => {
  const db = new DbdbCouch(config)

  return db.update()

  .catch((err) => {
    t.true(err instanceof Error)
  })
})

test('db.update should throw for missing id', (t) => {
  const doc = { type: 'entry' }
  const db = new DbdbCouch(config)

  return db.update(doc)

  .catch((err) => {
    t.true(err instanceof Error)
  })
})
