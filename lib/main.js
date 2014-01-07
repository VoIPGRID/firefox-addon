(function() {
    'use strict';

    // sdk
    var data = require('self').data;
    var notify = require('notifications').notify;
    var prefs = require('simple-prefs');
    var storage = require('simple-storage').storage;
    var system = require('system');

    // 3rd party
    var ToolbarButton = require('toolbarbutton').ToolbarButton;

    // 1st party
    var auth = require('./auth');
    var panels = require('./panels');
    var page = require('./page');

    var widgets = {
            'availability': require('./widgets/availability'),
            'queues': require('./widgets/queues'),
        },
        mainpanel,
        toolbarbutton;

    exports.main = function() {
        // host (application) information
        console.log('running ' + system.name + ' ' + system.version + ' on ' + system.platform);

        // use this url as the base for all outgoing api calls
        console.info('prefs.prefs["first_startup"] = ' + prefs.prefs['first_startup']);
        console.info('current preferences:');
        console.info(prefs.prefs);
        if(prefs.prefs['first_startup']) {
            prefs.prefs['first_startup'] = false;
            if(storage.user) {
                // force re-authentication after update
                logout();

                notify({
                    // 'Please note: the plugin click-to-dial has jus been updated. Click-to-dial works in your currently opened tabs when you refresh these.'
                    text: 'Let op: van de plugin klik&bel is zojuist een nieuwe versie geïnstalleerd. Klik&bel werkt pas weer op je geopende tabbladen wanneer je deze opnieuw hebt geladen.'
                });
            }
        }
        prefs.on('platform_url', function() {
            // re-authentication is necessary
            logout();
        });

        // keep track of some notifications
        storage.notifications = {};

        // panel initialization
        var widgetContentScripts = [];
        for(var widget in widgets) {
            for(var i in widgets[widget].contentScripts) {
                widgetContentScripts.push(widgets[widget].contentScripts[i]);
            }
        }
        mainpanel = new panels.MainPanel({
            widgetContentScripts: widgetContentScripts,
            widgets: widgets,
        });

        // widgets initialization
        for(widget in widgets) {
            widgets[widget].init(mainpanel.port);
        }

        // add a toolbarbutton for mainpanel
        toolbarbutton = new ToolbarButton({
            id: 'click-to-dial',
            label: 'Klik-en-bel', // 'Click-to-dial'
            image: data.url('assets/img/call-gray.png'),
            panel: mainpanel,
        });
        toolbarbutton.moveTo({
            toolbarID: 'nav-bar',
            forceMove: false,
        });
    };

    exports.setIcon = function(icon) {
        toolbarbutton.setIcon({
            url: data.url(icon)
        });
    };

    function logout() {
        console.info('logout');

        mainpanel.port.emit('logout');

        panels.resetWidgets();
        page.reset();
        delete storage.user;
        auth.removeCredentials();
    }
    exports.logout = function() {
        logout();
    };
})();
