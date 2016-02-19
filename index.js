'use strict';

const couchdb = require('./lib/couchdb');

// Use mock module in test environment if dbdbmock is installed
let useMock = (process.env.NODE_ENV === 'test');
try {
  if (useMock) {
    require.resolve('dbdbmock');
  }
} catch(e) {
  useMock = false;
}

if (useMock) {
  // Export test module
  module.exports = require('dbdbmock');
} else {
  // Export production module
  module.exports = {couchdb: couchdb};
}
