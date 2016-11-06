'use strict';

const S3Operator = require('../Operators/S3Operator');

class S3Storage {
  constructor(conf) {
    this.s3op = new S3Operator(conf);
  }

  storeInfo(type, id, info) {
    const key = this.generatePathLikeKey(type, id, 'info');
    return this.s3op.store(key, JSON.stringify(info, null, 2), 'text/json');
  }

  restoreInfo(type, id) {
    const key = this.generatePathLikeKey(type, id, 'info');
    return this.s3op.restore(key);
  }

  storeHost(type, id, host) {
    const key = this.generatePathLikeKey(type, id, 'hosts', host);
    return this.s3op.store(key, host, 'text/plain');
  }

  restoreHosts(type, id) {
    const key = this.generatePathLikeKey(type, id, 'hosts');
    return this.s3op.list(key).then((list) => {
      return list.map((v) => {
        return v.ShortKey;
      });
    });
  }

  // eslint-disable-next-line class-methods-use-this
  generatePathLikeKey() {
    return Array.prototype.join.call(arguments, '/');
  }
}

module.exports = S3Storage;
