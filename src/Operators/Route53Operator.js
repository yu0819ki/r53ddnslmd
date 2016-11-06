const _ = require('lodash');
const bb = require('bluebird');
const AWS = require('aws-sdk');
const logger = require('../Logger.js');

class Route53Operator {
  constructor(options) {
    this.HostedZoneId = options.HostedZoneId;
    this.r53 = bb.promisifyAll(new AWS.Route53(options), { suffix: 'Promised' });
  }

  getHostedZone(id) {
    return this.r53.getHostedZone({
      Id: id,
    }).then((result) => {
      return result.HostedZone;
    });
  }

  changeResourceRecordSet(action, resourceRecordSet) {
    return this.r53.changeResourceRecordSets({
      HostedZoneId: this.HostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: resourceRecordSet,
          },
        ],
      },
    }).catch((err) => {
      logger.error(err);
      return err;
    });
  }

  getResourceRecordSetsByIP(ipList) {
    return this.r53.listResourceRecordSets({
      HostedZoneId: this.HostedZoneId,
    }).then((result) => {
      return result.ResourceRecordSets.filter((ResourceRecordSet) => {
        return ResourceRecordSet.Type === 'A' && !_(ResourceRecordSet.ResourceRecords).filter((ResourceRecord) => {
          return !_(ipList).filter((ip) => {
            return ResourceRecord.Value === ip;
          }).isEmpty();
        }).isEmpty();
      });
    });
  }

  deleteRecordByIP(ipList) {
    return this.getResourceRecordSetsByIP(ipList).then((resourceRecordSets) => {
      return resourceRecordSets.map((resourceRecordSet) => {
        return this.changeResourceRecordSet('DELETE', resourceRecordSet);
      });
    });
  }

  createARecord(name, ip, ttl) {
    return this.getHostedZone(this.HostedZoneId).then((hostedZone) => {
      const resourceRecordSet = {
        Name: [name, hostedZone.Name].join('.'),
        Type: 'A',
        ResourceRecords: [
          {
            Value: ip,
          },
        ],
        TTL: ttl || 60,
      };
      return this.changeResourceRecordSet('CREATE', resourceRecordSet);
    });
  }
}

module.exports = Route53Operator;
