var socket = io.connect();
var allowed_commands = ["list", "get", "update", "put", "delete", "scan", "query", "use"];
var table;
var tconsole = $('.console').console({
   promptLabel: 'DynamoDB> ',
   commandValidate:function(line){
     var cmd = line.split(" ")[0];
     console.log("command: " + cmd);
     if (allowed_commands.indexOf(cmd) === -1) {
       console.log("if");
       return false;
     } else {
       console.log("else");
       return true;
     }
   },
   commandHandle:function(line, report){
      socket.on('response', function(data) {
        report(data.msg, "jquery-console-message-success");
        socket.removeAllListeners('response');
      });
      var p = line.split(" ");
      switch (p[0]) {
        case "list":
            socket.emit('dbcmd', {cmd:"LIST_TABLES"});
            break;
        case "get":
            var key = p[1], range = p[2], attrs = p[3];
            socket.emit('dbcmd', {cmd:"GET_ITEM", table:table, key:key, range:range, attrs:attrs});
            break;
        case "use":
            table = p[1];
            return report('using table: ' + table);
            break;
        default:
            return false;
      }
   },
   autofocus:true,
   animateScroll:true,
   promptHistory:true,
   welcomeMessage:"Welcome to DynamoDB Console! Supported commands: list, get, update, delete",
});
