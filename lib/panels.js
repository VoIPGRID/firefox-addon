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
    var clicktodial = require('./clicktodial');
    var main = require('./main');
    var page = require('./page');
    var timer = require('./timer');
    var translate = require('./translate').translate;

    var port,
        mainpanel,
        widgets = {};

    exports.MainPanel = function(options) {
        var contentScripts = [
            data.url('assets/lib/jquery/jquery.js'),
            data.url('assets/lib/translate/firefox-l10n-translate.js'),
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
                if(options.onHide) {
                    options.onHide();
                }

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
    var refreshWidgets = exports.refreshWidgets = function(update) {
        for(var widget in widgets) {
            mainpanel.port.emit('widget.close', widget);
            mainpanel.port.emit('widget.indicator.start', widget);
        }

        for(widget in widgets) {
            widgets[widget].load(update);
        }
    };

    /**
     * Reset all widgets.
     */
    exports.resetWidgets = function() {
        for(var widget in widgets) {
            widgets[widget].reset();
        }
    };

    /**
     * Log in with a username and password.
     */
    var login = exports.login = function(username, password) {
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
                        console.log('login.success');

                        var user = response.json;
                        if(user.client) {
                            // parse and set the client id as a new property
                            user.client_id = user.client.replace(/[^\d.]/g, '');
                            storage.user = user;

                            // perform some actions on login
                            main.login(storage.user);
                        } else {
                            main.logout();
                        }
                    },
                    onNotOk: function() {
                        // remove credentials
                        auth.removeCredentials();
                        mainpanel.port.emit('login.failed');
                    },
                }
            );
        });
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

            login(username, password);
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

        // refresh every widget and spin the icon while doing it
        mainpanel.port.on('refresh', function() {
            console.info('mainpanel.refresh');

            mainpanel.port.emit('mainpanel.refresh.start');
            refreshWidgets(true);
            mainpanel.port.emit('mainpanel.refresh.stop');
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

            auth.retrieveCredentials(function(credentials) {
                /**
                 * Open settings url with or without a token for auto login.
                 * Either opens:
                 *  - platformUrl + user/autologin/?token=*token*&username=*username*&next=/ + path (with token)
                 *  - platformUrl + path (without token)
                 */
                var openSettings = function(response) {
                    var path = 'client/' + storage.user.client_id + '/user/' + storage.user.id + '/change/#tabs-3';

                    // add token if possible
                    if(response.json.token) {
                        path = 'user/autologin/?token=' + response.json.token + '&username=' + credentials.username + '&next=/' + path;
                    }

                    var platformUrl = api.getPlatformUrl();
                    tabs.open(platformUrl + path);

                    mainpanel.hide();
                };

                api.asyncRequest(
                    api.getUrl('autologin'),
                    null,
                    'get',
                    {
                        onOk: openSettings,
                        onNotOk: openSettings,
                    }
                );
            });
        });

        // close mainpanel
        mainpanel.port.on('close', function() {
            console.info('mainpanel.close');

            mainpanel.hide();
        });

        // dial given number
        mainpanel.port.on('clicktodial.dial', function(b_number, silent) {
            clicktodial.dial(b_number, silent);
        });

        // currently, there is no other way to support
        // localization in content scripts, so asynchronous
        // seems the best available option
        mainpanel.port.on('translate', function(messageID, options) {
            console.info('mainpanel.translate');

            var count, placeholder = null;
            if(options.hasOwnProperty('count')) {
                count = options.count;
            }
            if(options.hasOwnProperty('placeholder')) {
                placeholder = options.placeholder;
            }
            var translated = translate(messageID, count, placeholder);
            mainpanel.port.emit('translated', messageID, options, translated);
        });
    }
})();
