'use strict';

const nano = require('nano');

function transformFromDb(doc) {
  doc.id = doc._id;
  delete doc._id;
  return doc;
}

function transformToDb(doc) {
  doc._id = doc.id;
  delete doc.id;
  return doc;
}

// Database service. Connects to CouchDB / Cloudant.
const DbdbCouch = function (config) {
  this.config = config;
  this._db = null;
};

DbdbCouch.dbType = 'couchdb';

DbdbCouch.prototype = {

  /**
   * Connects to database and returns an open connection.
   * If a connection is already opened, it is simply returned.
   * @returns {Promise} A promise for a connection to the database
   */
  connect: function () {
    return new Promise((resolve, reject) => {
      // Return database connnection if it is already opened
      if (this._db !== null) {
        resolve(this._db);
      }

      // Open database connection
      let requestDefaults = {};
      let conn = nano({ url: this.config.url, requestDefaults: requestDefaults }, () => {});
      this._db = conn.use(this.config.db);

      // Authenticate if needed
      if (this.config.key && this.config.password) {
        conn.auth(this.config.key, this.config.password, (err, body, headers) => {
          if (err) {
            return reject(err);
          }

          if (headers && headers['set-cookie']) {
            requestDefaults.headers = {cookie: headers['set-cookie']};
          }

          // Authenticated - return connection
          resolve(this._db);
        });
      } else {
        // No authentication need - return connection
        resolve(this._db);
      }
    });
  },

  /**
   * Disconnects the database if open.
   */
  disconnect: function () {
    this._db = null;
  },

  /**
   * Gets a document from the database with the given id.
   * @param {string} docid - Document id
   * @returns {Promise} Promise of a document object as json
   */
  get: function (docid) {
    return new Promise((resolve, reject) => {
      if (docid) {
        // Connect to database
        this.connect()
        .then((conn) => {
          // Get document
          conn.get(docid, (err, body) => {
            if (err) {
              // Could not load document
              let e = new Error('Could not get ' + docid + '. ' + err, 'notFound');
              e.name = 'NotFoundError';
              reject(e);
            } else {
              // Return body as json, but use .id
              resolve(transformFromDb(body));
            }
          });
        }, reject);
      } else {
        // No document id
        reject(new Error('Missing document id'));
      }
    });
  },

  /**
   * Gets results of a view from database.
   * Supports paged views when a pageSize is set, otherwise all documents
   * will be fetched.
   * @param {string} ddoc - Id of design document
   * @param {string} view - Id of view
   * @param {boolean} descend - Orders descending if true
   * @param {number} pageSize - Number of documents to fetch as one page
   * @param {number/string} pageStart - The page number to start from or last key from the page before
   * @returns {Promise} Promise of json from view
   */
  getView: function (ddoc, view, descend, pageSize, pageStart) {
    return new Promise((resolve, reject) => {
      // Connect to database
      this.connect()
      .then((conn) => {
        // Get view
        let query = {
          include_docs: 'true',
          descending: ((descend) ? 'true' : 'false')
        };
        if (pageSize) {
          if (typeof pageStart === 'string' || typeof pageStart === 'object') {
            query.limit = pageSize + 1;
            query.startkey = pageStart;
          } else {
            query.limit = pageSize;
            query.skip = pageStart || 0;
          }
        }
        conn.view(ddoc, view, query, (err, body) => {
          if (err) {
            reject(new Error('Could not get view ' + view + ' in ddoc ' + ddoc + '. ' + err));
          } else {
            // Get and return docs
            let docs = [];
            if (body.rows) {
              body.rows.forEach((row, index) => {
                // Include only rows with doc. If paged by startkey, skip first row.
                if (row.doc && (!query.startkey || index > 0)) {
                  docs.push(transformFromDb(row.doc));
                }
              });
            }
            resolve(docs);
          }
        });
      }, reject);
    });
  },

  /**
   * Inserts a document into the database.
   * Use `update` when inserting an existing document, to get the correct
   * revision number first.
   * @param {Object} doc - Document object
   * @returns {Promise} Promise of document object with the new revision and id
   */
  insert: function (doc) {
    return new Promise((resolve, reject) => {
      if (!doc) {
        reject(new Error('Missing document object'));
      } else {
        // Connect to database
        this.connect()
        .then((conn) => {
          // Insert document
          conn.insert(transformToDb(doc), (err, body) => {
            if (err) {
              // Could not put document
              reject('Could not put ' + doc.id + '. ' + err);
            } else {
              doc.id = body.id;
              doc._rev = body.rev;
              resolve(doc);
            }
          });
        }, reject);
      }
    });
  },

  /**
   * Updates a document in the database. Retrieves the existing document
   * from database and updates the values, before storing in the database.
   * @param {Object} doc - Document object
   * @returns {Promise} Promise of document object with the new revision
   */
  update: function (doc) {
    return new Promise((resolve, reject) => {
      if (!doc) {
        reject(new Error('Missing document object'));
      } else if (!doc.id) {
        reject(new Error('Missing id'));
      } else {
        // Get existing document
        resolve(this.get(doc.id));
      }
    })
    .then((olddoc) => {
      // Update with new values
      for (let key of Object.keys(doc)) {
        if ((!key.startsWith('_')) && (key !== 'createdAt')) {
          olddoc[key] = doc[key];
        }
      }

      // Insert into database and return new document object
      return this.insert(olddoc);
    });
  },

  /**
   * Inserts many documents into the database.
   * @param {Array} docs - Array of document objects
   * @returns {Promise} Promise of an array of document objects with the new revision and id
   */
  insertMany: function (docs) {
    return new Promise((resolve, reject) => {
      if (!docs) {
        reject('Missing documents array');
      } else if (docs.length === 0) {
        resolve([]);
      } else {
        // Connect to database
        this.connect()
        .then((conn) => {
          // Bulk update documents
          conn.bulk({ docs: docs.map((doc) => transformToDb(doc)) }, (err, body) => {
            if (err) {
              reject(err);
            } else {
              resolve(body);
            }
          });
        }, reject);
      }
    })
    .then((json) => {
      json.forEach((doc, i) => {
        docs[i].id = doc.id;
        docs[i]._rev = doc.rev;
        docs[i]._error = doc.error;
        docs[i]._reason = doc.reason;
      });
      return docs;
    },
    (err) => Promise.reject(new Error('Could not insert documents. ' + err)));
  },

  /**
   * Deletes many documents from the database.
   * @param {Array} docs - Array of document objects
   * @returns {Promise} Promise of an array of document objects with the new revision
   */
  deleteMany: function (docs) {
    return new Promise((resolve, reject) => {
      let toDelete = docs.map((doc) => {
        doc._deleted = true;
        return doc;
      });
      resolve(this.insertMany(toDelete));
    });
  }

};

module.exports = DbdbCouch;
