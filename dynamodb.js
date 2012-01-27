// You can read your credentials from a local file.
var credentials = {
  AccessKeyId : "AKIAJB4FODE7SURD6ZAA",
  SecretKey   : "26cTzYdggkbxbW6yl4sW4IdkJbQ4zuYCrmc0Ayhx"
};
var dynamoDB = require('dynamoDB')

var db;

exports.db = function() {
  if (db === undefined) {
    db = dynamoDB.DynamoDB(credentials);
  }
  return db;
};
