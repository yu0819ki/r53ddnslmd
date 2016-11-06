const _ = require('lodash');
const bb = require('bluebird');
const AWS = require('aws-sdk');
const logger = require('../Logger.js');

class EC2Operator {
  constructor(options) {
    this.ec2 = bb.promisifyAll(new AWS.EC2(options), { suffix: 'Promised' });
  }

  getInstance(instanceId) {
    return this.ec2.describeInstancesPromised({
      Filters: [
        {
          Name: 'instance-id',
          Values: [instanceId],
        },
      ],
    }).then((result) => {
      const instance = result.Reservations.reduce((prev, reservation) => {
        if (prev) {
          return prev;
        }
        return reservation.Instances.length > 0 ? reservation.Instances[0] : false;
      }, false);
      logger.info(instance);
      return instance;
    });
  }

  getPrivateIPByInstanceId(instanceId) {
    return this.getInstance(instanceId).then((instance) => {
      return _(instance).get('PrivateIpAddress', false);
    }
    );
  }
}

module.exports = EC2Operator;
