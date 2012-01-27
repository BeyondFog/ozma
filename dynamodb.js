// You can read your credentials from a local file.
var credentials = {
  AccessKeyId : "access key id",
  SecretKey   : "secret key"
};
var dynamoDB = require('dynamoDB')

var db;

exports.db = function() {
  if (db === undefined) {
    db = dynamoDB.DynamoDB(credentials);
  }
  return db;
};
