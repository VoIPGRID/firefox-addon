(function() {
    'use strict';

    // sdk
    var data = require('sdk/self').data;
    var storage = require('sdk/simple-storage').storage;

    // 1st party
    var api = require('../api');
    var panels = require('../panels');
    var timer = require('../timer');
    var sip = require('../sip');

    var name = 'contacts';

    exports.contentScripts = [
        data.url('assets/lib/sipml5/release/SIPml-api.js'),
        data.url('panel/assets/js/sip.js'),
        data.url('widgets/assets/js/contacts.js'),
    ];

    exports.init = function() {};

    exports.load = function(update) {
        api.asyncRequest(
            api.getUrl('phoneaccount') + '?active=true&order_by=description',
            null,
            'get',
            {
                onComplete: function() {
                    panels.emit('widget.indicator.stop', name);
                },
                onOk: function(response) {
                    var contacts = response.json.objects;
                    // remove accounts that are not currently subscribed
                    for(var i=contacts.length-1; i>=0; i--) {
                        if(!contacts[i].hasOwnProperty('sipreginfo')) {
                            contacts.splice(i, 1);
                        }
                    }

                    storage.widgets.contacts.unauthorized = false;

                    // store for later use in the sip module
                    storage.widgets.contacts.list = contacts;
                    if(contacts.length) {
                        panels.emit('contacts.reset');
                        panels.emit('contacts.fill', contacts, update);
                    } else {
                        panels.emit('contacts.empty');

                        // stop polling for presence information
                        // sip.stop();
                    }
                },
                onNotOk: function() {
                    // stop reconnection attempts
                    timer.stopTimer('sip.reconnect');

                    // cancel active subscriptions
                    sip.stop();
                },
                onUnauthorized: function() {
                    console.info('widget.unauthorized: ' + name);

                    // update authorization status
                    storage.widgets.contacts.unauthorized = true;

                    // display an icon explaining the user lacks permissions to use
                    // this feature of the plugin
                    panels.emit('widget.unauthorized', name);

                    // stop reconnection attempts
                    timer.stopTimer('sip.reconnect');

                    // cancel active subscriptions
                    sip.stop();
                },
            }
        );
    };

    exports.reset = function() {
        panels.emit('contacts.reset');
        panels.emit('contacts.empty');

        // stop polling for presence information
        sip.stop();
    };
})();
