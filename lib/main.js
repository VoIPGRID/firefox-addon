(function() {
    'use strict';

    // sdk.
    var data = require('sdk/self').data;
    var notify = require('sdk/notifications').notify;
    var prefs = require('sdk/simple-prefs');
    var storage = require('sdk/simple-storage').storage;
    var system = require('sdk/system');
    var ui = require('sdk/ui');
    var windows = require('sdk/windows').browserWindows;
    const { AddonManager } = require('resource://gre/modules/AddonManager.jsm');

    // 1st party
    var auth = require('./auth');
    var page = require('./page');
    var panels = require('./panels');
    var sip = require('./sip');

    var widgets = {
            'availability': require('./widgets/availability'),
            'contacts': require('./widgets/contacts'),
            'queues': require('./widgets/queues'),
        },
        mainpanel,
        togglebutton;

    exports.main = function() {
        // host (application) information
        console.log('running ' + system.name + ' ' + system.version + ' on ' + system.platform);

        // use this url as the base for all outgoing api calls
        console.info('prefs.prefs["first_startup"] = ' + prefs.prefs['first_startup']);
        console.info('current preferences:');
        console.info(JSON.stringify(prefs.prefs));
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
            onHide: function() {
                // manually uncheck toggle button
                setToggleButtonProperties({
                    checked: false,
                });
            },
        });

        // widgets initialization
        for(widget in widgets) {
            widgets[widget].init();
        }

        // add a togglebutton for mainpanel
        if(!storage.togglebuttonicon) {
            // initial button icon
            storage.togglebuttonicon = data.url('assets/img/call-gray.png');
        }
        togglebutton = new ui.ToggleButton({
            id: 'click-to-dial',
            label: 'Klik-en-bel', // 'Click-to-dial'
            icon: storage.togglebuttonicon,
            onChange: function(state) {
                if(state.checked) {
                    mainpanel.show({
                        position: togglebutton,
                    });
                }
            },
        });
        // Work around new windows acquiring the initial togglebutton icon.
        windows.on('open', function(window) {
            togglebutton.state(window, {
                icon: storage.togglebuttonicon,
            });
        });

        if(widgets['contacts']) {
            // make these versions available for sip.js
            AddonManager.getAddonByID('voipgrid@jetpack', function(addon) {
                function _getSIPmlVersion() {
                    // assume the directory name is "simpl5-{VERSION}"
                    var pathPrefix = 'sipml5-',
                        version;
                    widgets['contacts'].contentScripts.forEach(function(file) {
                        if(file.indexOf('SIPml') > 0) {
                            version = file.substring(file.indexOf(pathPrefix), file.substring(file.indexOf(pathPrefix)).indexOf('/') + file.indexOf(pathPrefix)).substring(pathPrefix.length);
                            return;
                        }
                    });
                    return version;
                }
                panels.emit('mainpanel', 'versions.sipml5',  _getSIPmlVersion());
                panels.emit('mainpanel', 'versions.addon', addon.version);
            });
        }

        // continue last session if credentials are still available
        if(storage.user) {
            auth.retrieveCredentials(function() {
                login(storage.user);
            });
        }
    };

    /**
     * Update togglebutton options for all open windows.
     */
    var setToggleButtonProperties = exports.setToggleButtonProperties = function(options) {
        // remember which icon should be always visibile for now
        // this is necessary because the button resets the icon
        // to its initial value after "unchecking" the togglebutton
        if(options.hasOwnProperty('icon')) {
            storage.togglebuttonicon = options.icon;
        } else {
            options['icon'] = storage.togglebuttonicon;
        }

        for (let window of windows) {
            togglebutton.state(window, options);
        }
    };

    var login = exports.login = function(user) {
        console.info('login.success');

        panels.emit('login.success', storage.user);

        // reset seen notifications
        storage.notifications['unauthorized'] = false;

        // start loading the widgets
        panels.refreshWidgets(false);

        // look for phone numbers in tabs from now on
        page.init();
    };

    var logout = exports.logout = function() {
        console.info('logout');

        panels.emit('logout');

        delete storage.user;
        panels.resetWidgets();
        page.reset();
        auth.removeCredentials();
    };
})();
