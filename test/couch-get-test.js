import test from 'ava'
import sinon from 'sinon'
import {setupNock, teardownNock} from './helpers/http'
import getConfig from './helpers/getConfig'

import DbdbCouch from '../lib/couchdb'

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

function setupGetDoc0 (nockScope) {
  return setupNock(nockScope)
    .get('/feednstatus/doc0')
    .reply(404, {
      error: 'not_found',
      reason: 'missing'
    })
}

function setupPostDocs (nockScope) {
  return setupNock(nockScope)
    .post('/feednstatus/_all_docs', {keys: ['doc1', 'doc2']})
    .query({include_docs: 'true'})
    .reply(200, {
      total_rows: 2496,
      offset: 0,
      rows: [
        {id: 'doc1', key: 'doc1', value: {rev: '8593'}, doc: {_id: 'doc1', _rev: '8593', type: 'entry', title: 'The title'}},
        {id: 'doc2', key: 'doc2', value: {rev: '8594'}, doc: {_id: 'doc2', _rev: '8594', type: 'entry', title: 'Another title'}}
      ]
    })
}

function setupPostDocsWithUnknown (nockScope) {
  return setupNock(nockScope)
    .post('/feednstatus/_all_docs', {keys: ['doc1', 'doc3']})
    .query({include_docs: 'true'})
    .reply(200, {
      total_rows: 2496,
      offset: 0,
      rows: [
        {id: 'doc1', key: 'doc1', value: {rev: '8593'}, doc: {_id: 'doc1', _rev: '8593', type: 'entry', title: 'The title'}},
        {key: 'doc3', error: 'not_found'}
      ]
    })
}

// Tests -- get document

test('db.get', (t) => {
  const db = new DbdbCouch(getConfig())

  t.is(typeof db.get, 'function')
})

test('db.get should return doc', (t) => {
  const nock = setupGetDoc1()
  const db = new DbdbCouch(getConfig(nock))

  return db.get('doc1')

  .then((obj) => {
    t.is(typeof obj, 'object')
    t.is(obj.id, 'doc1')
    t.is(obj.type, 'entry')
    t.is(obj.title, 'The title')

    teardownNock(nock)
  })
})

test('db.get should throw for non-existing document', (t) => {
  const nock = setupGetDoc0()
  const db = new DbdbCouch(getConfig(nock))

  return db.get('doc0')

  .catch((err) => {
    t.true(err instanceof Error)
    t.is(typeof err.message, 'string')
    t.is(err.name, 'NotFoundError')

    teardownNock(nock)
  })
})

test('db.get should throw for missing docid', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.get()

  .catch((err) => {
    t.true(err instanceof Error)
  })
})

test('db.get should throw when connection fails', (t) => {
  const nock = setupGetDoc1()
  const db = new DbdbCouch(getConfig(nock))
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'))

  return db.get('doc1')

  .catch((err) => {
    t.is(err, 'Failure')

    db.connect.restore()
    teardownNock(nock)
  })
})

test('db.get should return several docs', (t) => {
  const nock = setupPostDocs()
  const db = new DbdbCouch(getConfig(nock))

  return db.get(['doc1', 'doc2'])

  .then((docs) => {
    t.true(Array.isArray(docs))
    t.is(docs.length, 2)
    t.is(docs[0].id, 'doc1')
    t.is(docs[0].type, 'entry')
    t.is(docs[0].title, 'The title')
    t.is(docs[1].id, 'doc2')
    t.is(docs[1].type, 'entry')
    t.is(docs[1].title, 'Another title')

    teardownNock(nock)
  })
})

test('db.get should not call server for empty array', (t) => {
  const nock = setupPostDocs()
  const db = new DbdbCouch(getConfig(nock))

  return db.get([])

  .then((docs) => {
    // If we get here, there was no roundtrip to server,
    // as there is no path to handle this call
    t.true(Array.isArray(docs))
    t.is(docs.length, 0)

    teardownNock(nock)
  })
})

test('db.get should return null for missing docs', (t) => {
  const nock = setupPostDocsWithUnknown()
  const db = new DbdbCouch(getConfig(nock))

  return db.get(['doc1', 'doc3'])

  .then((docs) => {
    t.true(Array.isArray(docs))
    t.is(docs.length, 2)
    t.is(docs[0].id, 'doc1')
    t.is(docs[1], null)

    teardownNock(nock)
  })
})

test('db.get should throw on error', (t) => {
  const db = new DbdbCouch(getConfig())
  sinon.stub(db, 'connect').returns(Promise.resolve({fetch: (ids, cb) => { cb('err') }}))

  return db.get(['doc1', 'doc2'])

  .catch((err) => {
    t.truthy(err)
    db.connect.restore()
  })
})
