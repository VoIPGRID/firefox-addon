(function() {
    'use strict';

    // sdk
    var data = require('sdk/self').data;
    var Panel = require('sdk/panel').Panel;
    var prefs = require('sdk/simple-prefs');
    var storage = require('sdk/simple-storage').storage;
    var tabs = require('sdk/tabs');

    // 1st party
    var api = require('./api');
    var auth = require('./auth');
    var main = require('./main');
    var page = require('./page');
    var timer = require('./timer');

    var port,
        mainpanel,
        widgets = {};

    exports.MainPanel = function(options) {
        var contentScripts = [
            data.url('assets/lib/jquery/jquery.js'),
            data.url('panel/assets/js/panel.js'),
        ];
        // resets widget data
        storage.widgets = {};
        if(Object.keys(options.widgets).length) {
            widgets = options.widgets;

            contentScripts.push(data.url('panel/assets/js/widgets.js'));
            if(options.widgetContentScripts) {
                options.widgetContentScripts.forEach(function(contentScriptFile) {
                    contentScripts.push(contentScriptFile);
                });
            }
            storage.widgets.isOpen = {};
            for(var widget in options.widgets) {
                // initial state for widget
                storage.widgets.isOpen[widget] = false;
                // each widget can share variables here
                storage.widgets[widget] = {};
            }
        }

        mainpanel = new Panel({
            contentScriptFile: contentScripts,
            contentURL: data.url('panel/html/panel.html'),
            height: 0,
            width: 0,
            onHide: function() {
                console.info('mainpanel.onhide');

                storage.isMainPanelOpen = false;
                mainpanel.port.emit('mainpanel.onhide');

                timer.update();
            },
            onShow: function() {
                console.info('mainpanel.onshow');

                storage.isMainPanelOpen = true;
                mainpanel.port.emit('mainpanel.onshow');

                timer.update();
            },
        });
        // initial state for mainpanel
        storage.isMainPanelOpen  = false;

        mainPanelPort();

        return mainpanel;
    };

    exports.ClickToDialPanel = function(options) {
        var contentScripts = [
            // no need for jquery for very simple javascript tasks
            data.url('clicktodial/assets/js/clicktodialpanel.js')
        ];
        var clicktodialpanel = new Panel({
            contentScriptFile: contentScripts,
            contentURL: data.url('clicktodial/html/clicktodial.html'),
            height: 79,
            width: 300,
            onHide: function() {
                console.info('clicktodialpanel.onhide');

                // we no longer need this call's status
                timer.stopTimer('clicktodial.status');
                timer.unregisterTimer('clicktodial.status');

                // next time a new panel is created
                clicktodialpanel.destroy();

                // stop updating the call status
                timer.stopTimer('clicktodial.status');
            },
            onShow: function() {
                console.info('clicktodialpanel.onshow');

                // start updating the call status
                timer.startTimer('clicktodial.status');
            },
        });

        clicktodialpanel.port.on('clicktodialpanel.close', function() {
            console.info('clicktodialpanel.close');

            clicktodialpanel.hide();
        });

        return clicktodialpanel;
    };

    /**
     * Initiate retrieving the data for all widgets.
     */
    function refreshWidgets() {
        for(var widget in widgets) {
            mainpanel.port.emit('widget.close', widget);
            mainpanel.port.emit('widget.indicator.start', widget);
        }

        for(widget in widgets) {
            widgets[widget].load();
        }
    }

    /**
     * Reset all widgets.
     */
    function resetWidgets() {
        for(var widget in widgets) {
            widgets[widget].reset();
        }
    }
    exports.resetWidgets = function() {
        resetWidgets();
    };

    /**
     * Event listeners for mainpanel.
     */
    function mainPanelPort() {
        // set the panel's dimensions
        mainpanel.port.on('mainpanel.resize', function(size) {
            console.info('mainpanel.resize');

            mainpanel.resize(size.width, size.height);
        });

        // attempt to log in
        mainpanel.port.on('login.attempt', function(username, password) {
            console.info('login.attempt');

            mainpanel.port.emit('login.indicator.start');

            // attempt to authenticate stored credentials right after the password manager stored them
            auth.storeCredentials(username, password, function() {
                // make an api call to authenticate
                api.asyncRequest(
                    api.getUrl('systemuser'),
                    null,
                    'get',
                    {
                        onComplete: function() {
                            // reset login button
                            mainpanel.port.emit('login.indicator.stop');
                        },
                        onOk: function(response) {
                            // users are unique so find the user matching *username*
                            response.json.objects.forEach(function(user) {
                                if(user.email == username || user.username == username) {
                                    storage.user = user;
                                }
                            });

                            // parse and set the client id as a new property
                            storage.user.client_id = storage.user.client.replace(/[^\d.]/g, '');
                            mainpanel.port.emit('login.success', storage.user);

                            // reset seen notifications
                            storage.notifications['unauthorized'] = false;

                            // start loading the widgets
                            refreshWidgets();

                            // look for phone numbers in tabs from now on
                            page.init();
                        },
                        onNotOk: function() {
                            // remove credentials
                            auth.removeCredentials();
                            mainpanel.port.emit('login.failed');
                        },
                    }
                );
            });
        });

        // keep track of opened/closed widgets
        mainpanel.port.on('widget.open', function(widget) {
            console.info('widget.open');

            storage.widgets.isOpen[widget] = true;
            timer.update();
        });
        mainpanel.port.on('widget.close', function(widget) {
            console.info('widget.close');

            storage.widgets.isOpen[widget] = false;
            timer.update();
        });

        mainpanel.port.on('logout.attempt', function() {
            console.info('logout.attempt');

            main.logout();
        });

        // open the firefox plugin wiki page
        mainpanel.port.on('help', function() {
            console.info('mainpanel.help');

            tabs.open('http://wiki.voipgrid.nl/index.php/Firefox_plugin');
            mainpanel.hide();
        });

        // open the user change form on the platform
        mainpanel.port.on('settings', function() {
            console.info('mainpanel.settings');

            var platform_url = prefs.prefs['platform_url'];
            if(prefs.prefs['platform_url'].length && prefs.prefs['platform_url'].lastIndexOf('/') != prefs.prefs['platform_url'].length - 1) {
                // force trailing slash
                platform_url = platform_url + '/';
            }
            tabs.open(platform_url + 'client/' + storage.user.client_id + '/user/' + storage.user.id + '/change/#tabs-3');
            mainpanel.hide();
        });

        // close mainpanel
        mainpanel.port.on('close', function() {
            console.info('mainpanel.close');

            mainpanel.hide();
        });
    }
})();
