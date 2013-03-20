/**
 * Server script that will handle the communication server
 */
var io = require('socket.io').listen(1935), util = require('util'), _ = require('underscore')._;

// configure log level
io.set('log level', 1);

console.info("-- started server at port 1935");

io.on('connection', function (socket) {
    console.log("- new client accepted: " + socket.id);

    var command = new Command(socket);

    socket.on('server', function (data) {
        console.log("- data arrived on the socket queue");
        command.execute(data);
    });

    socket.on('disconnect', function () {
        console.log('- user disconnected');
        command.execute({cmd: 'disconnectUser'});
    });

});


/*
IMPLEMENTS NAMESPACE.
USING ENV VAR ?????
_.each(['development', 'staging', 'production'], function(element, index, list){
    var namespace = '/' + element;
    io.of(namespace).on('connection', function (socket) {
        console.log("- new client accepted: " + socket.id);
        console.log(socket);

        var command = new Command(socket);

        socket.on('server', function (data) {
            console.log("- data arrived on the socket queue");
            command.execute(data);
        });

        socket.on('disconnect', function () {
            console.log('- user disconnected');
            command.execute({cmd: 'disconnectUser'});
        });

    });
})
*/

/**
 * Encapsulate the socket and knows how to execute the required commands
 * @param socket
 * @constructor
 */
function Command(socket) {
    this.socket = socket;
};

/**
 * Verify that the data.cmd exists and invokes it providing the payload
 * @param data
 */
Command.prototype.execute = function (data) {
    var cmd = data.cmd;
    if (!this[cmd]) {
        throw "invoking an unknow command: " + cmd;
    }
    this[cmd].call(this, data.payload);
};

/**
 * With the exceptio on the registerUser comamnd any other comamnd emit using the Storage USER CHANNEL
 * No channel is required to come from client except for the registering user proceed.
 * @api public
 */
Command.prototype.registerUser = function (payload) {
    console.info("- registering user '" + payload.email + "' on channel #" + payload.channel);
    Storage.registerUser(this.socket.id, payload);
    io.sockets.emit(payload.channel, Packet.registeredUser(payload.email, payload.fullname));
    return this;
};

Command.prototype.disconnectUser = function () {
    var self = this;
    var user = Storage.find(self.socket.id);
    Storage.unregisterUser(self.socket.id);
    io.sockets.emit(user.channel, Packet.disconnectedUser(user.email, user.fullname));
};

Command.prototype.chatMessage = function (payload) {
    user = Storage.find(this.socket.id);
    if (user === undefined) {
        console.log("The socket id#" + this.socket.id + " is not present in the registered users");
        return;
    }
    console.log('- message from:', user.email, 'msg:', payload.message, 'channel', user.channel);
    this.socket.broadcast.emit(user.channel, Packet.sendChatMessage(user.email, user.fullname, payload.message));
    return this;
};

Command.prototype.domNotification = function (payload) {
    user = Storage.find(this.socket.id);
    this.socket.broadcast.emit(user.channel, Packet.domNotification(payload, user));
};

var Packet = {

    registeredUser: function (email, fullname) {
        return {cmd: 'registeredUser', payload: {email: email, fullname: fullname}};
    },

    disconnectedUser: function (email, fullname) {
        return {cmd: 'disconnectedUser', payload: {email: email, fullname: fullname }};
    },

    sendChatMessage: function (email, fullname, message) {
        return {cmd: 'chatMessage', payload: {email: email, fullname: fullname, message: message}};
    },

    domNotification : function(incomingPayload, user){
        incomingPayload.user = user;
        return {cmd: 'domNotification', payload: incomingPayload};
    }
}


// Storage ////////////////////////////////////////////////////////////////////
var Storage = {
    whois: {}
}

Storage.startGC = function () {
    setInterval(Storage.garbageCollector, 2000);
}

Storage.stopGC = function () {
    clearInterval(Storage.garbageCollector);
}

Storage.garbageCollector = function () {
    Storage.deleteDisconnectingUsers();

}
/**
 * registering a user but emitting the message only if it was not disconnecting
 * so:
 * - if exists and it was disconnecting the record should replace the previous
 *   one and clears the timer that will send disconnect user message
 * - if exists and it was NOT disconnecting the record should be added to the
 *   user list with a 2 on the email and the name and emit a message
 * - if it does not esixts just add emit a message
 */
Storage.registerUser = function (socketId, p) {
    user = Storage.findByEmail(p.email);

    if (user === undefined || user == null) {
        console.info("- registering a not existing user", p.email);
        this.whois[socketId] = createUser(socketId, p);
        console.log(this.whois);
        return true;
    } else if (user.disconnecting) {
        console.info("- recovering an existing user", user.email);
        delete this.whois[user.socketId];

        this.whois[socketId] = createUser(socketId, p);
        console.log(this.whois);
        return false;
    } else {
        console.info("- registring a second record for an existing user", user.email);
        p['fullname'] = p['fullname'];
        this.whois[socketId] = createUser(socketId, p);
        console.log(this.whois);
        return true;
    }

    function createUser(socketId, p) {
        p['socketId'] = socketId;
        p['disconnecting'] = false;
        p['createdAt'] = new Date();
        return p;
    }
};

Storage.unregisterUser = function (socketId) {
    var self = this, user = Storage.find(socketId);
    if (user == null) {
        return false;
    }

    console.info("- disconnecting websocket of user ", user.email);
    this.whois[socketId].disconnecting = true;
    this.whois[socketId].disconnectedAt = new Date();

    return true;
};

Storage.find = function (socketId) {
    return this.whois[socketId];
};

Storage.findByEmail = function (email) {
    for (var key in this.whois) {
        if (this.whois[key].email == email) {
            console.log("--- user found")
            return this.whois[key];
        }
    }
    return null;
};

Storage.deleteDisconnectingUsers = function () {
    now = new Date();

    for (var key in this.whois) {
        var disconnectedTime = this.whois[key].disconnectedAt;

        if (this.whois[key].disconnecting == true && differenceInSeconds(disconnectedTime, now) > 10) {
            console.log('deleting user', this.whois[key].email, 'socket', key, 'from whois presences');
            delete this.whois[key];
        }
    }

    function differenceInSeconds(earlierDate, latterDate) {
        if (earlierDate === undefined) return 0;
        difference = latterDate.getTime() - earlierDate.getTime();
        return Math.floor(difference / 1000);

    }
};

Storage.startGC();

process.on('exit', function () {
    Storage.stopGC();
    console.log('--- exiting from colloquy server.');
});
