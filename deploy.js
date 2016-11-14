'use strict';

const _ = require('lodash');
const bb = require('bluebird');
// eslint-disable-next-line import/no-extraneous-dependencies
const lmd = require('node-aws-lambda');
const conf = require('dotenv-safe').load();
const logger = require('./src/Logger');

const deploy = bb.promisify(lmd.deploy);

const lmdConf = _(conf).reduce((prev, v, k) => {
  if (!k.startsWith('LMD_')) {
    return prev;
  }

  const key = _.camelCase(k.replace(/^LMD_/, ''));
  return _.set(prev, key, v);
}, {});

deploy(`./dist/${lmdConf.functionName}.zip`, lmdConf).then(() => {
  logger.info('deploy finished');
}, (err) => {
  logger.error(err.message);
});
