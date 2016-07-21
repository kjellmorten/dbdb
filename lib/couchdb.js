const nano = require('nano')

// Convert _id to id
function transformFromDb (doc) {
  doc.id = doc._id
  delete doc._id
  return doc
}

// Convert id to _id
function transformToDb (doc) {
  doc._id = doc.id
  delete doc.id
  return doc
}

// Database service. Connects to CouchDB / Cloudant.
class DbdbCouch {
  constructor (config) {
    this.config = config
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
                const e = new Error('Could not get ' + docid + '. ' + err, 'notFound')
                e.name = 'NotFoundError'
                reject(e)
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
   * Supports paged views when a pageSize is set, otherwise all documents
   * will be fetched.
   * @param {string} id - Id of view. In CouchDb, this is in the format <ddoc>_<view>
   * @param {object} options - Query options. filter, pageSize, and pageStart
   * @returns {Promise} Promise of json from view
   */
  getView (id, options = {}) {
    return new Promise((resolve, reject) => {
      // If called with old signature
      if (typeof options === 'string') {
        id = id + ':' + options
        options = {}
        if (arguments[2]) {
          options.desc = arguments[2]
        }
      } else if (typeof options === 'boolean') {
        options = Object.assign({desc: options}, arguments[2])
      }

      options = Object.assign({pageStart: 0, pageSize: null, desc: false}, options)

      // Resolve ddoc and view names
      let [ddoc, view] = id.split(':')

      // Connect to database
      this.connect()
      .then((conn) => {
        // Default: Don't skip first
        let skipFirst = false

        // Prepare query
        const query = {
          include_docs: 'true',
          descending: options.desc.toString()
        }

        // Filter. Done through startkey and endkey in CouchDb
        if (options.filter) {
          query.startkey = options.filter.split('/')
          query.endkey = query.startkey.slice()
          if (options.desc) {
            query.startkey.push({})
          } else {
            query.endkey.push({})
          }
          query.inclusive_end = 'true'
        }

        // Paging. If startAfter is present, the page after the given key
        // is fetched. Otherwise, pageStart is used.
        if (options.pageSize) {
          if (options.startAfter) {
            query.limit = options.pageSize + 1
            query.startkey = options.startAfter
            skipFirst = true
          } else {
            query.limit = options.pageSize
            query.skip = options.pageStart || 0
          }
        }

        // Get view documents
        conn.view(ddoc, view, query, (err, body) => {
          if (err) {
            reject(new Error('Could not get view ' + view + ' in ddoc ' + ddoc + '. ' + err))
          } else {
            // Get and return docs
            let docs = []
            if (body.rows) {
              body.rows.forEach((row, index) => {
                // Include only rows with doc or value. If paged by pageStart as a key, skip first row.
                const doc = row.doc || row.value
                if (doc && (!skipFirst || index > 0)) {
                  docs.push(transformFromDb(Object.assign({_key: row.key}, doc)))
                }
              })
            }
            resolve(docs)
          }
        })
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
          conn.insert(transformToDb(doc), (err, {id, rev}) => {
            if (err) {
              // Could not put document
              reject('Could not put ' + doc.id + '. ' + err)
            } else {
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
      const toDelete = docs.map((doc) => Object.assign(doc, {_deleted: true}))
      resolve(this.insertMany(toDelete))
    })
  }

}

module.exports = DbdbCouch
