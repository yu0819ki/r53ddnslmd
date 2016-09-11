'use strict';
const AWS = require('aws-sdk');
const route53 = new AWS.Route53();
const ec2 = new AWS.EC2();
const s3 = new AWS.S3();
const logger = (() => { try { return require('winston-color'); } catch(err) { return false; }})() || console;

const conf = {
  HostedZoneId: 'YOUR_ROUTE53_HOSTED_ZONE_ID',
  Bucket: 'YOUR_S3_BUCKET',
  StorageClass: 'YOUR_S3_STORAGE_CLASS*OPTIONAL*'
}

const SmallBird = (thisArg, fn) => {
  return function() {
    const args = arguments;
    return new Promise((resolve, reject) => {
      Array.prototype.push.call(args, (err, data) => {
        err ? reject(err) : resolve(data);
      });
      fn.apply(thisArg, args);
    });
  }
}

class R53Operaor {
  constructor(conf) {
    this.HostedZoneId = conf.HostedZoneId
  }

  getHostedZone(id) {
    const ghz = SmallBird(route53, route53.getHostedZone);
    return ghz({
      Id: id
    }).then((result) => {
      return result.HostedZone;
    });
  }

  changeResourceRecordSet(action, resourceRecordSet) {
    const crrs = SmallBird(route53, route53.changeResourceRecordSets);
    return crrs({
      HostedZoneId: this.HostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: action,
            ResourceRecordSet: resourceRecordSet
          }
        ]
      }
    }).catch((err) => {
      logger.error(err);
      return err;
    });
  }

  getResourceRecordSetsByIP(ipList) {
    const lrrs = SmallBird(route53, route53.listResourceRecordSets);
    return lrrs({
      HostedZoneId: this.HostedZoneId
    }).then((result) => {
      return result.ResourceRecordSets.filter((v) => {
        return v.Type === 'A'
          && v.ResourceRecords.filter((v) => {
            return ipList.filter((ip) => {
                return v.Value === ip
              }).length > 0;
          }).length > 0;
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
            Value: ip
          },
        ],
        TTL: ttl || 60
      };
      return this.changeResourceRecordSet('CREATE', resourceRecordSet);
    });
  }
}

class EC2Operator {
  constructor(conf) {

  }

  getInstance(instanceId) {
    const desc = SmallBird(ec2, ec2.describeInstances);
    return desc({
      Filters: [
        {
          Name: 'instance-id',
          Values: [instanceId]

        }
      ]
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
      return instance ? instance.PrivateIpAddress : false;
    });
  }
}

class S3Operator {
  constructor(conf) {
    this.Bucket = conf.Bucket;
  }

  store(key, content, contentType) {
    const put = SmallBird(s3, s3.putObject);
    return put({
      Bucket: this.Bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
      StorageClass: this.StorageClass
    });
  }

  restore(key) {
    const get = SmallBird(s3, s3.getObject);
    return get({
      Bucket: this.Bucket,
      Key: key
    }).then((data) => {
      if (data.ContentType.match('json')) {
        return JSON.parse(data.Body.toString());
      } else if (data.ContentType.match('text')) {
        return data.Body.toString()
      }
      return data.Body;
    });
  }

  list(prefix) {
    const list = SmallBird(s3, s3.listObjects);
    return list({
      Bucket: this.Bucket,
      Prefix: prefix
    }).then((result) => {
      return result.Contents.map((content) => {
        return {
          Key: content.Key,
          ShortKey: content.Key.replace(prefix, '').replace(/^\/|\/$/g, '')
        };
      });
    })
  }

  remove(key) {
    const del = SmallBird(s3, s3.deleteObject);
    return del({
      Bucket: this.Bucket,
      Key: key
    });
  }
}

class DDNSStorage {
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

  generatePathLikeKey() {
    return Array.prototype.join.call(arguments, '/');
  }
}

const terminatedDownHandlerPromise = (event) => {
  const r53op = new R53Operaor(conf);
  const ddns = new DDNSStorage(conf);
  return ddns.restoreInfo('EC2', event.detail['instance-id']).then((instance) => {
    return r53op.deleteRecordByIP([instance.PrivateIpAddress]);
  }).then((promiseList) => {
    return Promise.all(promiseList);
  });
}

const wakeupHandlerPromise = (event) => {
  const ec2op = new EC2Operator(conf);
  const r53op = new R53Operaor(conf);
  const ddns = new DDNSStorage(conf);
  return ec2op.getInstance(event.detail['instance-id']).then((instance) => {
    const hostName = instance.Tags.reduce((prev, tag) => {
        if (prev) { return prev; }
        return tag.Key === 'Name' ? tag.Value : prev;
      }, false) || instance.InstanceId;
    return r53op.createARecord(hostName , instance.PrivateIpAddress).then((result) => {
      return Promise.all([
        result,
        ddns.storeInfo('EC2', instance.InstanceId, instance),
        ddns.storeHost('EC2', instance.InstanceId, hostName)
      ]);
    })
  });
}

exports.handler = (event, context) => {
  let promise;
  if (event.detail['state'] === 'terminated') {
    promise = terminatedDownHandlerPromise(event);
  } else if (event.detail['state'] === 'running') {
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
}