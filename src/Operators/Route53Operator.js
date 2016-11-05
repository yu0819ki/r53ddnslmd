const _ = require('lodash');
const bb = require('bluebird');
const AWS = require('aws-sdk');

AWS.config.update({
  region: 'ap-northeast-1',
});
const logger = require('../Logger.js');

class Route53Operator {
  constructor(options) {
    this.HostedZoneId = options.HostedZoneId;
    this.r53 = bb.promisifyAll(new AWS.Route53(options), { suffix: 'Promised' });
  }

  getHostedZone(id) {
    return this.r53.getHostedZone({
      Id: id,
    }).then(result =>
       result.HostedZone
    );
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
    }).then(result =>
      result.ResourceRecordSets.filter(ResourceRecordSet =>
        ResourceRecordSet.Type === 'A' && !_(ResourceRecordSet.ResourceRecords).filter(ResourceRecord =>
          !_(ipList).filter(ip =>
            ResourceRecord.Value === ip
          ).isEmpty()
        ).isEmpty()
      )
    );
  }

  deleteRecordByIP(ipList) {
    return this.getResourceRecordSetsByIP(ipList).then(resourceRecordSets =>
       resourceRecordSets.map(resourceRecordSet =>
         this.changeResourceRecordSet('DELETE', resourceRecordSet)
      )
    );
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
