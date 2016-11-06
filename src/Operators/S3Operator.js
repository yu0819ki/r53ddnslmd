const bb = require('bluebird');
const AWS = require('aws-sdk');

class S3Operator {
  constructor(options) {
    this.Bucket = options.Bucket;
    this.s3 = bb.promisifyAll(new AWS.S3(options), { suffix: 'Promised' });
  }

  store(key, content, contentType) {
    return this.s3.putObject({
      Bucket: this.Bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
      StorageClass: this.StorageClass,
    });
  }

  restore(key) {
    return this.s3.getObject({
      Bucket: this.Bucket,
      Key: key,
    }).then((data) => {
      if (data.ContentType.match('json')) {
        return JSON.parse(data.Body.toString());
      } else if (data.ContentType.match('text')) {
        return data.Body.toString();
      }
      return data.Body;
    });
  }

  list(prefix) {
    return this.s3.listObjects({
      Bucket: this.Bucket,
      Prefix: prefix,
    }).then((result) => {
      return result.Contents.map((content) => {
        return ({
          Key: content.Key,
          ShortKey: content.Key.replace(prefix, '').replace(/^\/|\/$/g, ''),
        });
      });
    });
  }

  remove(key) {
    return this.s3.deleteObject({
      Bucket: this.Bucket,
      Key: key,
    });
  }
}

module.exports = S3Operator;
