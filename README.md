# dbdb - simple database layer

For now, only Cloudant/CouchDb is supported, and the module is not inteded for general use. But feel free.

The idea is to abstract away database specifics for a few common document tasks, to be able to switch database in a project further down the road. I'll add new databases and more tasks, only as needed.

## Tasks available now:
- connect
- disconnect
- get
- getView
- insert
- update
- insertMany
- deleteMany
