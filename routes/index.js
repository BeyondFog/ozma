// Singleton for DynamoDB connection - created once at app startup.
var db = require('../dynamodb').db();

/*
 * GET home page.
 */

exports.index = function(req, res){
    console.log(req.user);
    res.render('index', {title:'FogDB'});
};

/*
 * POST /account/settings
 */

exports.account_post = function(req, res) {
    if (!req.loggedIn) {
      res.send('Authentication required', 401);
    } else {
      if (req.body.aws_aki === undefined) {
        res.send('You must specify and Amazon Access Key ID via aws_aki param', 400);
      } else if (req.body.aws_sak === undefined) {
        res.send('You must specify and Amazon Secret Access Key via aws_sak param', 400);
      } else {
        // Update settings
        db.updateItem({
            TableName:"accounts"
            , Key:{HashKeyElement:{"S":req.user.id}}
            , AttributeUpdates: {"aws_access_key_id":{"Value":{"S":req.body.aws_aki}},
                                 "aws_secret_access_key":{"Value":{"S":req.body.aws_sak}}
                                }
            , ReturnValues: "ALL_NEW"
          },
          function(response, result) {
            result.on('ready', function(data) {
              console.log(data);
              var user = {id:req.user.id,
                aws_access_key_id:data.Attributes.aws_access_key_id.S,
                aws_secret_access_key:data.Attributes.aws_secret_access_key.S};
              var body = JSON.stringify(user);
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              });
              res.end(body)
            });
          });
      }
    }
};

/*
 * GET /account/settings
 */

exports.account_get = function(req, res) {
    if (!req.loggedIn) {
      res.send('Authentication required', 401);
    } else {
      db.getItem({
          TableName:"accounts"
        , Key:{HashKeyElement:{"S":req.user.id}}
        , AttributesToGet:["email", "password", "aws_access_key_id", "aws_secret_access_key"]
        , ConsistentRead: true
        }
      , function(response, result) {
          result.on('ready', function(data) {
            if (data.Item === undefined) {
              callback("could not find user", null);
            } else {
              var aws_aki = null;
              var aws_sak = null;;
              if (data.Item.aws_access_key_id !== undefined) {
                aws_aki = data.Item.aws_access_key.S;
              }
              if (data.Item.aws_secret_access_key !== undefined) {
                aws_sak = data.Item.aws_secret_access_key.S;
              }
              var user = {id:data.Item.email.S,
                aws_access_key_id:aws_aki,
                aws_secret_access_key:aws_sak};
              var body = JSON.stringify(user);
              res.writeHead(200, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              });
              res.end(body)
           }
        })
      });
    }
};
