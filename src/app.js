'use strict';

const logger = require('./Logger');
const R53ddnslmd = require('./R53ddnslmd');

const conf = require('dotenv-safe').load();

exports.handler = (event, context) => {
  let promise;
  const app = new R53ddnslmd(conf);
  if (event.detail.state === 'terminated') {
    promise = app.terminatedHandler(event);
  } else if (event.detail.state === 'running') {
    promise = app.wakeupHandler(event);
  } else {
    promise = Promise.resolve(event);
  }
  promise.then((results) => {
    logger.info(results);
    context.succeed(results);
  }).catch((err) => {
    logger.error(err);
    context.fail(err);
  });
};
