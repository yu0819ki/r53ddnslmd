'use strict';

const logger = require('./Logger');
const R53Operator = require('./Operators/Route53Operator');
const EC2Operator = require('./Operators/EC2Operator');
const DDNSStorage = require('./Storages/S3Storage');

class R53ddnslmd {
  constructor(conf) {
    this.ec2op = new EC2Operator(conf);
    this.r53op = new R53Operator(conf);
    this.ddns = new DDNSStorage(conf);
  }

  terminatedHandler(event) {
    return this.ddns.restoreInfo('EC2', event.detail['instance-id']).then((instance) => {
      return this.r53op.deleteRecordByIP([instance.PrivateIpAddress]);
    }).then((promiseList) => {
      return Promise.all(promiseList);
    });
  }

  wakeupHandler(event) {
    return this.ec2op.getInstance(event.detail['instance-id']).then((instance) => {
      const hostName = instance.Tags.reduce((prev, tag) => {
          if (prev) { return prev; }
          return tag.Key === 'Name' ? tag.Value : prev;
        }, false) || instance.InstanceId;
      return this.r53op.createARecord(hostName, instance.PrivateIpAddress).then((result) => {
        return Promise.all([
          result,
          this.ddns.storeInfo('EC2', instance.InstanceId, instance),
          this.ddns.storeHost('EC2', instance.InstanceId, hostName),
        ]);
      });
    });
  }
}

module.exports = R53ddnslmd;