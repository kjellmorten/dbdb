import test from 'ava'

import {couchdb} from '../index'

test('couchdb', (t) => {
  t.is(typeof couchdb, 'function', 'should exist')
  t.is(couchdb.dbType, 'couchdb', 'should be couchdb')
})
