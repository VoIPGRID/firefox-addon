(function() {
    'use strict';

    // sdk
    var storage = require('sdk/simple-storage').storage;
    var timers = require('sdk/timers');

    // 1st party
    var panels = require('./panels');
    var timer = require('./timer');

    var isInitialized = false,
        realm = 'websocket.voipgrid.nl',
        retryTimeout = 5000;

    // reconnect to presence resource
    function reconnect_func() {
        if(timer.getRegisteredTimer('sip.reconnect')) {
            panels.emit('mainpanel', 'sip.start');
        }
    }

    var init = exports.init = function() {
        console.info('sip.init');

        if(!isInitialized) {
            isInitialized = true;

            // setup reconnect timer
            timer.registerTimer('sip.reconnect', reconnect_func);
            timer.setTimeout('sip.reconnect', retryTimeout);

            // respond to sip status updates from mainpanel
            panels.on('sip.status', function(status, reconnect) {
                console.info('sip.status - ' + status);

                // keep track of status
                if(storage.widgets) {
                    storage.widgets.contacts.status = status;
                }

                if(status == 'connecting') {
                    // do nothing
                } else if(status == 'failed_to_start') {
                    if(reconnect) {
                        timer.startTimer('sip.reconnect');
                    } else {
                        timer.stopTimer('sip.reconnect');
                    }
                } else if(status == 'connected') {
                    var n = 0;
                    storage.widgets.contacts.list.forEach(function(contact) {
                        timers.setTimeout(function() {
                            subscribe('' + contact.account_id);
                        }, n++*200);
                    });

                    timer.stopTimer('sip.reconnect');
                } else if(status == 'disconnected') {
                    if(reconnect) {
                        timer.startTimer('sip.reconnect');
                    } else {
                        timer.stopTimer('sip.reconnect');
                    }
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

        panels.emit('mainpanel', 'sip.stop');
    };
})();
