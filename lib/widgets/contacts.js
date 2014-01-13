(function() {
    'use strict';

    // sdk
    var data = require('sdk/self').data;
    var storage = require('sdk/simple-storage').storage;

    // 1st party
    var api = require('../api');
    var timer = require('../timer');

    var name = 'contacts',
        port;

    exports.contentScripts = [
        data.url('assets/lib/sipml5/SIPml-api.min.js'),
        data.url('widgets/assets/js/contacts.js'),
        data.url('widgets/assets/js/sip-config.js'),
        data.url('widgets/assets/js/sip.js'),
    ];

    exports.init = function(_port) {
        port = _port;

    };

    function getContacts(onOk) {
        api.asyncRequest(
            api.getUrl('phoneaccount') + '?active=true&order_by=internal_number',
            null,
            'get',
            {
                onComplete: function() {
                    port.emit('widget.indicator.stop', name);
                },
                onOk: onOk
            }
        );
    }

    exports.load = function(update) {
        getContacts(function(response) {
            var contacts = response.json.objects;
            // remove accounts that are not currently subscribed
            for(var i=contacts.length-1; i>=0; i--) {
                if(!contacts[i].hasOwnProperty('sipreginfo')) {
                    contacts.splice(i, 1);
                }
            }

            if(contacts.length) {
                port.emit('contacts.reset', storage.user);
                port.emit('contacts.fill', contacts);

                if(update) {
                    // update presence subscriptions
                    port.emit('sip.update');
                } else {
                    // start polling for presence information for these contacts
                    port.emit('sip.init', storage.user.email, storage.user.token);
                }
            } else {
                port.emit('contacts.empty');

                // stop polling for presence information
                port.emit('sip.stop');
            }
        });
    };

    exports.reset = function() {
        port.emit('contacts.reset', storage.user);
        port.emit('contacts.empty');
        port.emit('sip.stop');
    };
})();
