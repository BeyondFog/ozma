
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , everyauth = require('everyauth')
  , bcrypt = require('bcrypt')
  , sessions = require('cookie-sessions')
  , io = require('socket.io')
  , dynamoDB = require('dynamoDB')
  , db = require('./dynamodb').db();

var app = module.exports = express.createServer();
var use_user_cache = false;
var user_cache = {};
var session_store;

var session_secret = "d41d8cd98f00b204e9800998ecf8427e";

function find_user(uid, callback) {
  if (use_user_cache && user_cache[uid] !== undefined) {
    console.log("caching dynamodb lookup for userid: " + uid);
    callback(null, user_cache[uid]);
  } else {
    db.getItem({
        TableName:"accounts"
      , Key:{HashKeyElement:{"S":uid}}
      , AttributesToGet:["email", "password", "aws_access_key_id", "aws_secret_access_key"]
      , ConsistentRead: true
      }
    , function(response, result) {
        result.on('ready', function(data) {
          console.log("foobared");
          if (data.Item === undefined) {
            callback("could not find user", null);
          } else {
            var aws_aki;
            var aws_sak;
            if (data.Item.aws_access_key_id !== undefined) {
              aws_aki = data.Item.aws_access_key_id.S;
            }
            if (data.Item.aws_secret_access_key !== undefined) {
              aws_sak = data.Item.aws_secret_access_key.S;
            }
            var user = {id:data.Item.email.S,
              aws_access_key_id:aws_aki,
              aws_secret_access_key:aws_sak};
            user_cache[uid] = user;
            callback(null, user);
         }
      })
    });
  }
}

// Password authentication setup.
everyauth.everymodule.findUserById(find_user);

// Note: Monkey patch the cookie-sessions library to make readSession return {} instead
// of undefined if cookie is not found. Everyauth expects these semantics.
sessions.readSession = function(key, secret, timeout, req){
    // Reads the session data stored in the cookie named 'key' if it validates,
    // otherwise returns an empty object.

    var cookies = sessions.readCookies(req);
    if(cookies[key]){
        return sessions.deserialize(secret, timeout, cookies[key]);
    }
    return {};
};

everyauth.password
  .getLoginPath('/login') // Uri path to the login page
  .loginWith('email')
  .postLoginPath('/login') // Uri path that your login form POSTs to
  .loginLocals({'title':'login'})
  .loginView('login.jade')
  .authenticate(function (email, password) {
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
                  aws_aki = data.Item.aws_access_key_id.S;
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
  .registerUser(function (newUserAttributes) {
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



app.configure('development', function(){
  // Note: cookie-based sessions in dev
  session_store = sessions({secret: session_secret});
  app.use(session_store);
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  use_user_cache = true;
});

app.configure('production', function(){
  // Note: we will want to use either cookie-based or persistant sessions in prod
  session_store = express.session({secret: session_secret});
  app.use(session_store);
  app.use(express.errorHandler());
  use_user_cache = false;
});

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', { pretty: true });
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(everyauth.middleware());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

everyauth.helpExpress(app);

// Routes
app.get('/', routes.index);

app.post('/account/settings', routes.account_post);
app.get('/account/settings', routes.account_get);

var port = process.env.PORT || 3000;
app.listen(port);
// For Heroku
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});
var sio = io.listen(app);

var parseCookie = require('connect').utils.parseCookie;

sio.set('authorization', function(data, accept) {
  if (data.headers.cookie) {
    console.log("got a socket connection with a cookie");
    // XXX specific to cookie sessions
    data.cookie = parseCookie(data.headers.cookie);
    try {
      data.session = sessions.deserialize(session_secret, 86400000, data.cookie['_node']);
      accept(null, true);
    } catch (e) {
      accept('Bad auth cookie', false);
    }
  } else {
    console.log("rejected a socket connection");
    accept('No auth cookie', false);
  }
});

sio.sockets.on('connection', function(socket) {
  console.log('socket connected, session: '+ socket.handshake.session);
  socket.on('dbcmd', function(data) {
    console.log("got a message!");
    // 1. Look up the user for the current session
    find_user(socket.handshake.session.auth.userId, function(err, user_obj) {
      if (err) {
        consolelog("!!! error: " + err);
        return;
      }
      console.dir(user_obj);
      var credentials = {
        AccessKeyId : user_obj.aws_access_key_id,
        SecretKey   : user_obj.aws_secret_access_key
      };
      var udb = dynamoDB.DynamoDB(credentials);

      switch (data.cmd) {
        case "LIST_TABLES":
          udb.listTables({}, function(response, result) {
            result.on('ready', function(data) {
              if (data.error) {
                socket.emit('response', {msg:"error: " + data.error});
              } else {
                socket.emit('response', {msg:"Tables: " + data.TableNames});
              }
            });
          });


      }
    });
  });
});


console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
