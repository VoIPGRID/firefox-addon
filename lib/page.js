(function() {
    'use strict';

    // sdk
    var cm = require('sdk/context-menu');
    var data = require('sdk/self').data;
    var PageMod = require('sdk/page-mod').PageMod;
    var prefs = require('sdk/simple-prefs');
    var storage = require('sdk/simple-storage').storage;

    // 1st party
    var analytics = require('./analytics');
    var clicktodial = require('./clicktodial');
    var panels = require('./panels');
    var translate = require('./translate').translate;

    // hardcoded blacklist of sites because there is not yet a solution
    // that works for chrome and firefox using exclude site-urls.
    //
    // these sites are blocked primarily because they are javascript-heavy
    // which in turn leads to 100% cpu usage when trying to parse all the
    // mutations for too many seconds making it not responsive.
    //
    // the content script still tracks <a href="tel:xxxx"> elements.
    var blacklist = [
        // we prefer not to add icons in documents
        '^https?.*docs\\.google\\.com.*$',
        '^https?.*drive\\.google\\.com.*$',

        // pages on these websites tend to grow too large to parse them in a reasonable amount of time
        '^https?.*bitbucket\\.org.*$',
        '^https?.*github\\.com.*$',
        '^https?.*rbcommons\\.com.*$',

        // this site has at least tel: support and uses javascript to open a new web page
        // when clicking the anchor element wrapping the inserted icon
        '^https?.*slack\\.com.*$',
        data.url('panel/html/popout.html'),
    ];

    var webpageContentScriptFiles = [
            data.url('assets/lib/zepto/zepto.min.js'),
            data.url('page/assets/js/parsers/dutch.js'),
            data.url('page/assets/js/walker.js'),
            data.url('page/assets/js/observer.js')
        ],
        webpageWorkers = [],
        popoutContentScriptFiles = [
            data.url('assets/lib/jquery/jquery.js'),
            data.url('assets/lib/translate/firefox-l10n-translate.js'),
            data.url('panel/assets/js/panel.js'),
            data.url('panel/assets/js/popout.js'),
            data.url('panel/assets/js/widgets.js'),
        ].concat(require('./widgets/contacts').contentScripts),
        popoutWorkers = [],
        contextMenuItem;

    exports.init = function() {
        console.info('page.init');

        // inject our phone number finder in every page
        new PageMod({
            include: '*',
            contentScriptFile: webpageContentScriptFiles,
            contentScriptWhen: 'end',
            attachTo: ['existing', 'top', 'frame'],

            onAttach: function(webpageWorker) {
                console.info('attached webpageWorker to: ' + webpageWorker.tab.url);

                // keep track of running workers (open tabs which our scripts run on)
                webpageWorkers.push(webpageWorker);
                webpageWorker.on('detach', function() {
                    console.log('webpageWorker detached');

                    var index = webpageWorkers.indexOf(this);
                    if(index != -1) {
                        webpageWorkers.splice(index, 1);
                    }
                });

                // when the webpageContentScriptFiles are loaded this event is sent
                webpageWorker.port.on('page.observer.ready', function() {
                    // start looking for phone numbers in the page if
                    // click to dial is enabled and the user is authenticated
                    if(prefs.prefs['click_to_dial_enabled'] && storage.user) {
                        // test for blacklisted sites
                        for(var i = 0; i < blacklist.length; i++) {
                            if(new RegExp(blacklist[i]).test(webpageWorker.tab.url)) {
                                console.info('not observing: ' + webpageWorker.tab.url);
                                return;
                            }
                        }

                        console.info('observing: ' + webpageWorker.tab.url);
                        webpageWorker.port.emit('page.observer.start');
                    }
                });

                // dial given number
                webpageWorker.port.on('clicktodial.dial', function(b_number) {
                    clicktodial.dial(b_number);
                    analytics.trackClickToDial('Webpage');
                });
            }
        });

        // add context menu item to dial selected number
        contextMenuItem = cm.Item({
            image: data.url('page/assets/img/call-green.png'),
            label: translate('contextMenuLabel'),
            context: cm.SelectionContext(),
            contentScriptFile: [
                // no need for jquery
                data.url('page/assets/js/selection.js')
            ],
            onMessage: function(b_number) {
                clicktodial.dial(b_number);
                analytics.trackClickToDial('Webpage');
            }
        });
    };

    exports.initPopout = function() {
        new PageMod({
            include: data.url('panel/html/popout.html'),
            contentScriptFile: popoutContentScriptFiles,
            contentScriptWhen: 'end',
            attachTo: ['top'],

            onAttach: function(popoutWorker) {
                console.info('attached popoutWorker');

                // let `panels.js` communicate with this worker's port
                panels.addPort(popoutWorker.port, 'popout');

                // keep track of running workers (open tabs which our scripts run on)
                popoutWorker.on('detach', function() {
                    console.log('popoutWorker detached');

                    panels.removePort(popoutWorker.port, 'popout');
                });
            }
        });
    };

    exports.reset = function() {
        if(contextMenuItem) {
            contextMenuItem.destroy();
        }

        if(prefs.prefs['click_to_dial_enabled']) {
            for(var i in webpageWorkers) {
                try{
                    webpageWorkers[i].port.emit('page.observer.stop');
                } catch(e) {
                    webpageWorkers.splice(i, 1);
                }
            }
        }
    };
})();
