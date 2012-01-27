// Password authentication setup.
// FIXME: Hits DynamoDB on every authenticated request to assemble user object
everyauth.everymodule.findUserById(function(uid, callback) {
  console.log("userid: " + uid);
  db.getItem({
      TableName:"accounts"
    , Key:{HashKeyElement:{"S":uid}}
    , AttributesToGet:["email", "password", "aws_access_key_id", "aws_secret_access_key"]
    , ConsistentRead: true
    }
  , function(response, result) {
      result.on('ready', function(data) {
        if (data.Item === undefined) {
          callback("could not find user", null);
        } else {
          var aws_aki;
          var aws_sak;
          if (data.Item.aws_access_key_id !== undefined) {
            aws_aki = data.Item.aws_access_key;
          }
          if (data.Item.aws_secret_access_key !== undefined) {
            aws_sak = data.Item.aws_secret_access_key.S;
          }
          console.log(data.Item);
          callback(null, {id:data.Item.email.S,
            aws_access_key_id:aws_aki,
            aws_secret_access_key:aws_sak});
       }
    })
  });
});

everyauth.password
  .getLoginPath('/login') // Uri path to the login page
  .loginWith('email')
  .postLoginPath('/login') // Uri path that your login form POSTs to
  .loginLocals({'title':'login'})
  .loginView('login.jade')
  .authenticate( function (email, password) {
    var promise = this.Promise();
    db.getItem({
        TableName:"accounts"
      , Key:{HashKeyElement:{"S":email}}
      , AttributesToGet:["password", "aws_access_key_id", "aws_secret_access_key"]
      , ConsistentRead: true
      }
    , function(response, result) {
        result.on('ready', function(data) {
          if (data.Item === undefined) {
            promise.fulfill(["login failure"]);
          } else {
            bcrypt.compare(password, data.Item.password.S, function(err, res) {
              if (res) {
                var aws_aki;
                var aws_sak;
                if (data.Item.aws_access_key_id !== undefined) {
                  aws_aki = data.Item.aws_access_key;
                }
                if (data.Item.aws_secret_access_key !== undefined) {
                  aws_sak = data.Item.aws_secret_access_key.S;
                }
                promise.fulfill({id:email,
                  aws_access_key_id:aws_aki,
                  aws_secret_access_key:aws_sak});
              } else {
                promise.fulfill(["password mismatch"]);
              }
            });
          }
        })
     });
    return promise;
  })
  .loginSuccessRedirect('/') // Where to redirect to after a login

    // If login fails, we render the errors via the login view template,
    // so just make sure your loginView() template incorporates an `errors` local.
    // See './example/views/login.jade'

  .getRegisterPath('/register') // Uri path to the registration page
  .postRegisterPath('/register') // The Uri path that your registration form POSTs to
  .registerView('register.jade')
  .registerLocals({'title':'register'})
  .validateRegistration(function(newUserAttributes, errors) {
    // Check whether email is already in use
    var promise = this.Promise();
    db.getItem({TableName:"accounts"
      , Key:{HashKeyElement:{"S":newUserAttributes.email}}
      , AttributesToGet:["password"]
      , ConsistentRead: true
      }
    , function(response, result) {
        result.on('ready', function(data) {
          if (data.Item !== undefined) {
            errors.push("Email address already in use");
          }
          promise.fulfill(errors);
        })
     });
     return promise;
  })
  .registerUser( function (newUserAttributes) {
    var promise = this.Promise();
    var email = newUserAttributes.email;
    var password = newUserAttributes.password;
    bcrypt.genSalt(10, function(err, salt) {
      bcrypt.hash(password, salt, function(err, hash) {
        db.putItem({
            TableName:"accounts",
            Item:{
              email:{"S":email},
              password:{"S":hash},
              created_date:{"N":new Date().getTime().toString()}
            }
          },
          function(response, result) {
            result.on('ready', function(data) {
              promise.fulfill({id:email,
                aws_access_key_id:null, aws_secret_access_key:null});
            });
          });
      })
    });
    return promise;
  })
  .registerSuccessRedirect('/'); // Where to redirect to after a successful registration
