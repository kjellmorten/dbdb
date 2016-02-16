# dbdb - simple database layer

`dbdb` abstracts away database specifics for a few common document tasks. The main motivation is to be able to switch database in a project quickly further down the road. The starting point is a document database, and this is reflected in the module.

For now, only Cloudant/CouchDb is supported. I'll add new databases and more tasks only as I need them.

The module is not written for general use, but feel free. :)

Oh, and it is written in ES6.

## Tasks available now:
- connect
- disconnect
- get
- getView
- insert
- update
- insertMany
- deleteMany

That's it.

## Install

```
npm install dbdb
```

## Use
```
const Dbdb = require('dbdb').couchdb;

let db = new Dbdb({
  url: 'https://url.to.database',
  db: 'thedatabase',
  key: 'key-or-username',
  password: 'password'
});

db.get('doc1').then((doc) => {
  ...
});
```
