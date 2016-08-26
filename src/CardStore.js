import PouchDB from 'pouchdb';

class CardStore {
  constructor(options) {
    this.db = new PouchDB('cards', { storage: 'persistant', ...options });
  }

  getCards() {
    return new Promise((resolve, reject) => {
      this.db.allDocs({ include_docs: true, descending: true }).then(
        result => resolve(result.rows.map(row => row.doc))
      ).catch(err => reject(err));
    });
  }

  putCard(card) {
    // XXX Fill in _id only if not set
    return this.db.put({ ...card, _id: new Date().toISOString() })
      .then(result => ({ ...card, _id: result.id, _rev: result.rev }));
  }

  onUpdate(func) {
    this.db.changes({ since: 'now', live: true }).on('change', func);
  }

  // Sets a server for synchronizing with an begins live synchonization.
  //
  // |syncServer| may be any of the following:
  // - A string with the address of a remote server (beginning 'http://' or
  //   'https://')
  // - A PouchDB instance (for unit testing -- we should have have waited on
  //   then() before calling this since PouchDB seems to drop then() after
  //   calling it. Odd.)
  // - Null / undefined / empty string to clear the associated with the existing
  //   remote server, if any.
  //
  // |callbacks| is an optional object argument which may provide the following
  // callback functions:
  // - onChange
  // - onPause
  // - onActive
  // - onError
  setSyncServer(syncServer, callbacks) {
    // Fill out callbacks with empty functions as-needed
    if (!callbacks) {
      callbacks = {};
    }
    [ 'onChange', 'onPause', 'onActive', 'onError' ].forEach(key => {
      callbacks[key] = callbacks[key] || (() => {});
    });

    // Validate syncServer argument
    if (typeof syncServer !== 'string' &&
        syncServer !== null &&
        syncServer !== undefined &&
        !(typeof syncServer === 'object' &&
          syncServer.constructor === PouchDB)) {
      const err = { code: 'INVALID_SERVER',
                    message: 'Unrecognized type of sync server' };
      callbacks.onError(err);
      return Promise.reject(err);
    }

    if (typeof syncServer === 'string') {
      syncServer = syncServer.trim();
      if (syncServer &&
          !syncServer.startsWith('http://') &&
          !syncServer.startsWith('https://')) {
        const err = { code: 'INVALID_SERVER',
                      message: 'Only http and https remote servers are'
                              + ' recognized' };
        callbacks.onError(err);
        return Promise.reject(err);
      }
    }

    // XXX Skip this if the server hasn't, in fact, changed
    if (this.remoteSync) {
      this.remoteSync.cancel();
      this.remoteSync = undefined;
      this.remoteDb = undefined;
    }

    if (!syncServer) {
      return Promise.resolve();
    }

    this.remoteDb = typeof syncServer === 'string'
                    ? new PouchDB(syncServer)
                    : syncServer;

    return this.remoteDb
      // Force a connection to the server so we can detect errors immediately
      .then(() => this.remoteDb.info())
      .catch(err => {
        this.remoteDb = undefined;
        callbacks.onError(err);
        throw err;
      }).then(() => {
        this.remoteSync = this.db.sync(this.remoteDb, {
          live: true,
          retry: true,
        })
        // XXX Go through and tidy up the input before passing along to the
        // callbacks
        .on('change',   callbacks.onChange)
        .on('paused',   callbacks.onPause)
        .on('active',   callbacks.onActive)
        .on('error',    callbacks.onError)
        .on('denied',   callbacks.onError)
        .on('complete', callbacks.onPause);

        // As far as I can tell, this.remoteSync is a then-able that resolves
        // when the sync finishes. However, since we specified 'live: true'
        // that's not going to happen any time soon, so we need to be careful
        // *not* to return this.remoteSync here.
        // resolve until the sync finishes.
        return this.remoteDb;
      });
  }

  // Intended for unit testing only

  destroy() { return this.db.destroy(); }
  getSyncServer() { return this.remoteDb; }
}

export default CardStore;
