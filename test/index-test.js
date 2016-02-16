'use strict';

const test = require('tape');

const couchdb = require('../index').couchdb;

test('couchdb', (t) => {
  t.equal(typeof couchdb, 'function', 'should exist');
  t.equal(couchdb.dbType, 'couchdb', 'should be couchdb');
  t.end();
});
