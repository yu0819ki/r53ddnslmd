'use strict';

const logger = require('./Logger');
const R53Operator = require('./Operators/Route53Operator');
const EC2Operator = require('./Operators/EC2Operator');
const DDNSStorage = require('./Storages/S3Storage');

const conf = require('dotenv-safe').load();

const terminatedDownHandlerPromise = (event) => {
  const r53op = new R53Operator(conf);
  const ddns = new DDNSStorage(conf);
  return ddns.restoreInfo('EC2', event.detail['instance-id']).then((instance) => {
    return r53op.deleteRecordByIP([instance.PrivateIpAddress]);
  }).then((promiseList) => {
    return Promise.all(promiseList);
  });
};

const wakeupHandlerPromise = (event) => {
  const ec2op = new EC2Operator(conf);
  const r53op = new R53Operator(conf);
  const ddns = new DDNSStorage(conf);
  return ec2op.getInstance(event.detail['instance-id']).then((instance) => {
    const hostName = instance.Tags.reduce((prev, tag) => {
      if (prev) { return prev; }
      return tag.Key === 'Name' ? tag.Value : prev;
    }, false) || instance.InstanceId;
    return r53op.createARecord(hostName, instance.PrivateIpAddress).then((result) => {
      return Promise.all([
        result,
        ddns.storeInfo('EC2', instance.InstanceId, instance),
        ddns.storeHost('EC2', instance.InstanceId, hostName),
      ]);
    });
  });
};

exports.handler = (event, context) => {
  let promise;
  if (event.detail.state === 'terminated') {
    promise = terminatedDownHandlerPromise(event);
  } else if (event.detail.state === 'running') {
    promise = wakeupHandlerPromise(event);
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
