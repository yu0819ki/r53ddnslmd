'use strict';

const AWS = require('aws-sdk');
const app = require('./src/app');
const logger = require('./src/Logger');

AWS.config.update({
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  region: 'YOUR_REGION'
});

// eslint-disable-next-line import/no-extraneous-dependencies
const argv = require('minimist')(process.argv.slice(2), {
  alias: {
    i: 'instanceId',
    s: 'state',
  },
});

class Context {

  // eslint-disable-next-line class-methods-use-this
  done(err, message) {
    if (err) {
      logger.error(err);
      throw err instanceof Error ? err : new Error(err);
    }
    logger.info(message);
    return message;
  }

  succeed(message) {
    return this.done(null, message);
  }

  fail(err) {
    return this.done(err);
  }
}

const ctx = new Context();
const evt = {
  detail: {
    'instance-id': argv.instanceId,
    state: argv.state,
  },
};
app.handler(evt, ctx);
