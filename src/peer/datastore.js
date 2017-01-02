// @flow

const { clone } = require('lodash')
const Levelup = require('levelup')
const serialize = require('../metadata/serialize')
const Multihashing = require('multihashing')
const Multihash = require('multihashes')

export type DatastoreOptions = {
  backend: 'memory', // just in-memory for now, expand to e.g. rocksdb
  location?: string
}

const DefaultOptions: DatastoreOptions = {
  backend: 'memory'
}

class Datastore {
  db: Levelup

  constructor (options: ?DatastoreOptions = null) {
    if (options == null) {
      options = DefaultOptions
    } else {
      options = Object.assign(clone(DefaultOptions), options)
    }

    const levelOpts: Object = {}
    switch (options.backend) {
      case 'memory':
        levelOpts.db = require('memdown')
        break

      default:
        throw new Error(`Datastore backend ${options.backend} not supported`)
    }

    levelOpts.valueEncoding = valueCodec
    const location = (options.location == null || options.location === '')
      ? '/aleph/data-' + Math.random().toString()
      : options.location

    this.db = Levelup(location, levelOpts)
  }

  put (value: Buffer | Object): Promise<string> {
    if (!Buffer.isBuffer(value)) {
      value = serialize.encode(value)
    }

    const mh = Multihashing(value, 'sha2-256')
    const key = Multihash.toB58String(mh)

    return new Promise((resolve, reject) => {
      this.db.put(key, value, {}, (err) => {
        if (err) return reject(err)
        resolve(key)
      })
    })
  }

  get (key: string, opts: {returnRawBuffer?: boolean} = {}): Promise<Object | string> {
    return new Promise((resolve, reject) => {
      this.db.get(key, (err, val) => {
        if (err) return reject(err)

        if (opts.returnRawBuffer === true) {
          return resolve(val)
        }

        try {
          return resolve(serialize.decode(val))
        } catch (err) {
          return resolve(val.toString('base64'))
        }
      })
    })
  }
}

const valueCodec = {
  type: 'noop',
  buffer: true,

  encode (val: Buffer): Buffer {
    return val
  },

  decode (buf: Buffer): Buffer {
    return buf
  }
}

module.exports = {
  Datastore
}
