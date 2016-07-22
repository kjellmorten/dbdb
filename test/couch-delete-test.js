import test from 'ava'
import sinon from 'sinon'
import {setupNock, teardownNock} from './helpers/http'
import getConfig from './helpers/getConfig'

import DbdbCouch from '../lib/couchdb'

// Helpers

function setupDoc (nockScope) {
  return setupNock(nockScope)
    .head('/feednstatus/doc1')
    .reply(200, null, {ETag: '2774761001'})
    .delete('/feednstatus/doc1')
    .query({rev: '2774761001'})
    .reply(200, {
      id: 'doc1',
      ok: true,
      rev: '3774761001'
    })
    .head('/feednstatus/doc0')
    .reply(404, {
      error: 'not_found',
      reason: 'missing'
    })
}

function setupDocWrongRev (nockScope) {
  return setupNock(nockScope)
    .head('/feednstatus/doc2')
    .reply(200, null, {ETag: '1774761001'})
    .delete('/feednstatus/doc2')
    .query({rev: '1774761001'})
    .reply(409, {
      error: 'conflict',
      reason: 'Document update conflict'
    })
}

// Tests

test('should exist', (t) => {
  const db = new DbdbCouch()

  t.is(typeof db.delete, 'function')
})

test('should delete document', (t) => {
  const nock = setupDoc()
  const db = new DbdbCouch(getConfig(nock))

  return db.delete('doc1')

  .then((ret) => {
    t.deepEqual(ret, {
      id: 'doc1',
      _deleted: true,
      _rev: '3774761001'
    })

    teardownNock(nock)
  })
})

test('should reject for non-existing document', (t) => {
  const nock = setupDoc()
  const db = new DbdbCouch(getConfig(nock))

  return db.delete('doc0')

  .catch((err) => {
    t.true(err instanceof Error)
    t.is(typeof err.message, 'string')
    t.is(err.name, 'NotFoundError')

    teardownNock(nock)
  })
})

test('should reject for other error', (t) => {
  const nock = setupDoc()
  const db = new DbdbCouch(getConfig(nock))

  return db.delete('doc100')

  .catch((err) => {
    t.true(err instanceof Error)
    t.is(typeof err.message, 'string')
    t.is(err.name, 'Error')

    teardownNock(nock)
  })
})

test('db.get should reject for missing docid', (t) => {
  const db = new DbdbCouch(getConfig())

  return db.delete()

  .catch((err) => {
    t.true(err instanceof Error)
    t.is(err.message, 'Missing doc id')
  })
})

test('should reject when connection fails', (t) => {
  const nock = setupDoc()
  const db = new DbdbCouch(getConfig(nock))
  sinon.stub(db, 'connect').returns(Promise.reject('Failure'))

  return db.delete('doc1')

  .catch((err) => {
    t.is(err, 'Failure')

    db.connect.restore()
    teardownNock(nock)
  })
})

test('should reject for wrong rev', (t) => {
  const nock = setupDocWrongRev()
  const db = new DbdbCouch(getConfig(nock))

  return db.delete('doc2')

  .catch((err) => {
    t.true(err instanceof Error)
    t.is(typeof err.message, 'string')
    t.is(err.name, 'ConflictError')

    teardownNock(nock)
  })
})
