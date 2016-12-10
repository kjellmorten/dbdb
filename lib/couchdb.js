const nano = require('nano')

// Convert _id to id
function transformFromDb (doc) {
  doc.id = doc._id
  delete doc._id
  return doc
}

// Convert id to _id
function transformToDb (doc) {
  if (doc.id) {
    doc._id = doc.id
  }
  delete doc.id
  return doc
}

// Create error from nano err
const createError = (err, message) => {
  const error = new Error(message + ' ' + err.reason)
  switch (err.error) {
    case 'conflict':
      error.name = 'ConflictError'
      break
    case 'not_found':
      error.name = 'NotFoundError'
      break
  }
  return error
}

// Prepare query for getView
const prepareViewQuery = (options) => {
  // Prepare query
  const query = {
    include_docs: (options.keysOnly) ? 'false' : 'true',
    descending: options.desc.toString()
  }

  // Filter. Done through startkey and endkey in CouchDb
  if (options.filter) {
    query.inclusive_end = 'true'
    if (Array.isArray(options.filter)) {
      query.startkey = options.filter.slice()
      query.endkey = options.filter.slice()
      if (options.desc) {
        if (!options.firstKey) {
          query.startkey.push({})
        }
      } else {
        if (!options.lastKey) {
          query.endkey.push({})
        }
      }
    } else {
      query.startkey = query.endkey = options.filter
      if (options.firstKey) {
        console.warn('Only array filters can be combined with firstKey.')
        return false // Do not query. Result will be empty anyway.
      }
    }
  }

  // Start from a given `firstKey` or skip the `first` number
  // of results
  if (options.firstKey) {
    query.startkey = (Array.isArray(query.startkey))
      ? query.startkey.concat(options.firstKey)
      : options.firstKey
  } else if (options.first) {
    query.skip = options.first
  }

  // End with a given `lastKey`
  if (options.lastKey) {
    query.endkey = (Array.isArray(query.endkey))
      ? query.endkey.concat(options.lastKey)
      : options.lastKey
  }

  // Limit the number of results
  if (options.max) {
    query.limit = options.max
  }

  return query
}

// Database service. Connects to CouchDB / Cloudant.
class DbdbCouch {
  constructor (config) {
    this.config = Object.assign({}, config)
    this._db = null
    this.dbType = DbdbCouch.dbType
  }

  static get dbType () {
    return 'couchdb'
  }

  /**
   * Connects to database and returns an open connection.
   * If a connection is already opened, it is simply returned.
   * @returns {Promise} A promise for a connection to the database
   */
  connect () {
    // Return promise of database connnection if it already exists
    if (this._db === null) {
      this._db = new Promise((resolve, reject) => {
        // Open database connection
        let conn = nano({url: this.config.url})

        // Authenticate if needed
        if (this.config.key && this.config.password) {
          conn.auth(this.config.key, this.config.password, (err, body, headers) => {
            if (err) {
              return reject(err)
            }

            // Authenticated - set up new connection with cookie
            if (headers && headers['set-cookie']) {
              let cookie = headers['set-cookie']
              if (Array.isArray(cookie)) {
                cookie = headers['set-cookie'].filter((str) => str.startsWith('AuthSession='))[0]
              }
              cookie = cookie.replace(/;.*$/, '')
              conn = nano({url: this.config.url, cookie})
            }

            // Select database and return connection
            resolve(conn.use(this.config.db))
          })
        } else {
          // Select database and return connection
          resolve(conn.use(this.config.db))
        }
      })
    }

    return this._db
  }

  /**
   * Disconnects the database if open.
   */
  disconnect () {
    this._db = null
  }

  /**
   * Gets a document from the database with the given id.
   * @param {string} docid - Document id
   * @returns {Promise} Promise of a document object as json
   */
  get (docid) {
    return new Promise((resolve, reject) => {
      if (docid) {
        // Connect to database
        this.connect()
        .then((conn) => {
          // Get several documents
          if (Array.isArray(docid)) {
            if (docid.length === 0) {
              resolve([])
            } else {
              conn.fetch({keys: docid}, (err, body) => {
                if (err) {
                  reject(new Error('Could not fetch documents'))
                } else {
                  const docs = body.rows.map((item) => (item.doc) ? transformFromDb(item.doc) : null)
                  resolve(docs)
                }
              })
            }
          } else {
            // Get one document
            conn.get(docid, (err, body) => {
              if (err) {
                reject(createError(err, `Could not get doc ${docid}.`))
              } else {
                resolve(transformFromDb(body))
              }
            })
          }
        }, reject)
      } else {
        // No document id
        reject(new Error('Missing document id'))
      }
    })
  }

  /**
   * Gets results of a view from database.
   * Supports paged views when a max value is set, otherwise all documents
   * will be fetched.
   * @param {string} id - Id of view. In CouchDb, this is in the format <ddoc>_<view>
   * @param {object} options - Query options. filter, max, first, firstKey, and lastKey
   * @returns {Promise} Promise of json from view
   */
  getView (id, options = {}) {
    return new Promise((resolve, reject) => {
      // If called with old signature
      if (typeof options === 'boolean') {
        options = Object.assign({desc: options}, arguments[2])
      }

      options = Object.assign({first: null, max: null, desc: false}, options)

      // Resolve ddoc and view names
      let [ddoc, view] = id.split(':')

      // Connect to database
      this.connect()
      .then((conn) => {
        const query = prepareViewQuery(options)

        if (query) {
          // Get view documents
          conn.view(ddoc, view, query, (err, body) => {
            if (err) {
              reject(new Error('Could not get view ' + view + ' in ddoc ' + ddoc + '. ' + err))
            } else {
              // Get and return docs
              let docs = []
              if (body.rows) {
                body.rows.forEach((row, index) => {
                  // Include only rows with doc or value
                  const doc = row.doc || row.value
                  if (doc) {
                    docs.push(transformFromDb(Object.assign({_key: row.key}, doc)))
                  }
                })
              }
              resolve(docs)
            }
          })
        } else {
          resolve([]) // prepareViewQuery concluded that the result would be empty
        }
      }, reject)
    })
  }

  /**
   * Inserts a document into the database.
   * Use `update` when inserting an existing document, to get the correct
   * revision number first.
   * @param {Object} doc - Document object
   * @returns {Promise} Promise of document object with the new revision and id
   */
  insert (doc) {
    return new Promise((resolve, reject) => {
      if (!doc) {
        reject(new Error('Missing document object'))
      } else {
        // Connect to database
        this.connect()
        .then((conn) => {
          // Insert document
          conn.insert(transformToDb(doc), (err, body) => {
            if (err) {
              // Could not insert document
              reject(createError(err, `Could not insert doc ${doc.id}.`))
            } else {
              const {id, rev} = body
              resolve(Object.assign({}, doc, {id, _rev: rev}))
            }
          })
        }, reject)
      }
    })
  }

  /**
   * Updates a document in the database. Retrieves the existing document
   * from database and updates the values, before storing in the database.
   * @param {Object} doc - Document object
   * @returns {Promise} Promise of document object with the new revision
   */
  update (doc) {
    return new Promise((resolve, reject) => {
      if (!doc) {
        reject(new Error('Missing document object'))
      } else if (!doc.id) {
        reject(new Error('Missing id'))
      } else {
        // Get existing document
        resolve(this.get(doc.id))
      }
    })
    .then((olddoc) => {
      const newdoc = Object.assign({}, olddoc)

      // Update with new values
      const keys = Object.keys(doc).filter((key) => !(key.startsWith('_') || (key === 'createdAt')))
      keys.forEach((key) => { newdoc[key] = doc[key] })

      // Insert into database and return new document object
      return this.insert(newdoc)
    })
  }

  /**
   * Deletes a document in the database.
   * @param {Object} doc - Document object to delete
   * @returns {Promise} Promise of document object with the new revision
   */
  delete (docid) {
    return new Promise((resolve, reject) => {
      if (docid) {
        this.connect()
        .then((conn) => {
          conn.head(docid, (err, body, headers) => {
            if (err) {
              reject(createError(err, `Could not delete doc ${docid}.`))
            } else {
              conn.destroy(docid, headers.etag, (err, body) => {
                if (err) {
                  reject(createError(err, `Could not delete doc ${docid}.`))
                } else {
                  resolve({id: docid, _deleted: true, _rev: body.rev})
                }
              })
            }
          })
        }, reject)
      } else {
        reject(new Error('Missing doc id'))
      }
    })
  }

  /**
   * Inserts many documents into the database.
   * @param {Array} docs - Array of document objects
   * @returns {Promise} Promise of an array of document objects with the new revision and id
   */
  insertMany (docs) {
    return new Promise((resolve, reject) => {
      if (!docs) {
        reject('Missing documents array')
      } else if (docs.length === 0) {
        resolve([])
      } else {
        // Connect to database
        this.connect()
        .then((conn) => {
          // Bulk update documents
          conn.bulk({ docs: docs.map((doc) => transformToDb(doc)) }, (err, body) => {
            if (err) {
              reject(err)
            } else {
              resolve(body)
            }
          })
        }, reject)
      }
    })
    .then(
      (json) => json.map(({id, rev, error, reason}, i) =>
        Object.assign({}, docs[i], {id, _rev: rev, _error: error, _reason: reason})),
      (err) => Promise.reject(new Error('Could not insert documents. ' + err))
    )
  }

  /**
   * Deletes many documents from the database.
   * @param {Array} docs - Array of document objects
   * @returns {Promise} Promise of an array of document objects with the new revision
   */
  deleteMany (docs) {
    return new Promise((resolve, reject) => {
      const toDelete = docs.map((doc) => Object.assign({}, doc, {_deleted: true}))
      resolve(this.insertMany(toDelete))
    })
  }

}

module.exports = DbdbCouch
