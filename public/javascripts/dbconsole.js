var socket = io.connect('http://localhost');
var allowed_commands = ["list", "get", "update", "put", "delete", "scan", "query"];
var tconsole = $('.console').console({
   promptLabel: 'DynamoDB> ',
   commandValidate:function(line){
     if (allowed_commands.indexOf(line) === -1) return false;
     else return true;
   },
   commandHandle:function(line, report){
      socket.on('response', function(data) {
        report(data.msg, "jquery-console-message-success");
        socket.removeAllListeners('response');
      });
      if (line == "list") {
        socket.emit('dbcmd', {cmd:"LIST_TABLES"});
      } else {
        return false;
      }
   },
   autofocus:true,
   animateScroll:true,
   promptHistory:true,
   welcomeMessage:"Welcome to DynamoDB Console! Supported commands: list, get, update, delete",
});
