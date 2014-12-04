(function() {
    'use strict';

    // sdk
    var storage = require('sdk/simple-storage').storage;

    // 1st party
    var panels = require('./panels');
    var timer = require('./timer');

    var isInitialized = false,
        realm = 'websocket.voipgrid.nl',
        retryTimeout = 5000;

    // reconnect to presence resource
    function reconnect() {
        if(timer.getRegisteredTimer('sip.reconnect')) {
            panels.emit('mainpanel', 'sip.start');
        }
    }

    var init = exports.init = function() {
        console.info('sip.init');

        if(!isInitialized) {
            isInitialized = true;

            // setup reconnect timer
            timer.registerTimer('sip.reconnect', reconnect);
            timer.setTimeout('sip.reconnect', retryTimeout);

            // respond to sip status updates from mainpanel
            panels.on('sip.status', function(status) {
                console.info('sip.status - ' + status);

                // keep track of status
                if(storage.widgets) {
                    storage.widgets.contacts.status = status;
                }

                if(status == 'connecting') {
                    // do nothing
                } else
                if(status == 'failed_to_start') {
                    // start reconnection attempts
                    timer.setTimeout('sip.reconnect', retryTimeout);
                    timer.startTimer('sip.reconnect');
                } else
                if(status == 'connected') {
                    storage.widgets.contacts.list.forEach(function(contact) {
                        subscribe('' + contact.account_id);
                    });

                    // stop reconnection attempts
                    timer.stopTimer('sip.reconnect');
                } else
                if(status == 'disconnected') {
                    // do nothing
                }

                // send status to all ports
                panels.emit('contacts.' + status);
            }, 'mainpanel');

            // provide init options besides the callback functions - these
            // functions are defined in the local scope on the receiving end
            panels.emit('mainpanel', 'sip.config', {
                realm: realm,
                impi: storage.user.email, // user email address
                impu: 'sip:' + storage.user.email + '@' + realm,
                password: storage.user.token, // user access token
                display_name: '', // empty as long as we're just subscribing
                websocket_proxy_url: 'wss://' + realm,
            });
        }
    };

    exports.start = function() {
        console.info('sip.start');

        if(!isInitialized) {
            init();
        }

        panels.emit('mainpanel', 'sip.start');
    };

    exports.update = function(reload) {
        console.info('sip.update', reload);

        if(!isInitialized) {
            init();
        }

        var account_ids = [];
        storage.widgets.contacts.list.forEach(function(contact) {
            account_ids.push(''+contact.account_id);
        });

        storage.widgets.contacts.status = undefined;
        if(reload) {
            timer.startTimer('sip.reconnect');
        }
        panels.emit('mainpanel', 'sip.update', reload, account_ids);
    };

    var subscribe = function(account_id) {
        console.info('sip.subscribe ' + account_id);

        panels.emit('mainpanel', 'sip.subscribe', account_id);
    };

    exports.stop = function() {
        console.info('sip.stop');

        // stop reconnection attempts
        timer.stopTimer('sip.reconnect');
        timer.unregisterTimer('sip.reconnect');

        panels.emit('mainpanel', 'sip.stop');
    };
})();
