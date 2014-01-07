(function() {
    'use strict';

    // sdk
    var cm = require('context-menu');
    var data = require('self').data;
    var PageMod = require('page-mod').PageMod;
    var prefs = require('simple-prefs');
    var storage = require('simple-storage').storage;

    // 1st party
    var clicktodial = require('./clicktodial');

    var contentScriptFiles = [
            data.url('assets/lib/jquery/jquery.js'),
            data.url('page/assets/js/observer.js'),
        ],
        contextMenuItem,
        workers = [];

    exports.init = function() {
        console.info('page.init');

        // inject our phone number finder in every page
        new PageMod({
            include: '*',
            contentScriptFile: contentScriptFiles,
            contentScriptWhen: 'end',
            attachTo: ['existing', 'top', 'frame'],

            onAttach: function(worker) {
                console.info('attached worker to: ' + worker.tab.url);

                // keep track of running workers (open tabs which our scripts run on)
                workers.push(worker);

                // when the contentScriptFiles are loaded this event is sent
                worker.port.on('page.observer.ready', function() {
                    // start looking for phone numbers in the page if
                    // click to dial is enabled and the user is authenticated
                    if(prefs.prefs['click_to_dial_enabled'] && storage.user) {
                        console.info('observing: ' + worker.tab.url);
                        worker.port.emit('page.observer.start');
                    } else {
                        console.info('not observing: ' + worker.tab.url);
                    }
                });

                // dial given number
                worker.port.on('clicktodial.dial', function(b_number) {
                    clicktodial.dial(b_number);
                });
            }
        });

        // add context menu item to dial selected number
        contextMenuItem = cm.Item({
            label: 'Bel geselecteerde nummer', // 'Call selected number'
            context: cm.SelectionContext(),
            contentScriptFile: [
                // no need for jquery
                data.url('page/assets/js/selection.js')
            ],
            onMessage: function(b_number) {
                clicktodial.dial(b_number);
            }
        });
    };

    exports.reset = function() {
        if(contextMenuItem) {
            contextMenuItem.destroy();
        }

        if(prefs.prefs['click_to_dial_enabled']) {
            for(var i in workers) {
                try{
                    workers[i].port.emit('page.observer.stop');
                } catch(e) {
                    workers.splice(i, 1);
                }
            }
        }
    };
})();
