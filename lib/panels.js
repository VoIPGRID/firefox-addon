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
    var sip = require('./sip');
    var timer = require('./timer');
    var translate = require('./translate').translate;

    var ports = {'mainpanel': [], 'popout': []},
        mainpanel,
        widgets = {};

    /**
     * Add a workers' port for given type.
     */
    var addPort = exports.addPort = function(port, type) {
        var index = ports[type].indexOf(port);
        if(index == -1) {
            ports[type].push(port);

            // set handlers to deal with messages from this port
            setHandlersOn(port, type);
        }

        console.log('port added for type "' + type + '"');
    };

    /**
     * Remove a workers' port of given type.
     * This stops emitting messages to this port.
     */
    var removePort = exports.removePort = function(port, type) {
        var index = ports[type].indexOf(port);
        if(index != -1) {
            ports[type].splice(index, 1);
        }

        console.log('port removed for type "' + type + '"');
    };

    /**
     * A stringify-function which doesn't throw a
     * "TypeError: cyclic object value" and adds indenting to the output.
     */
    function _stringify(obj) {
        var seen = [];
        return JSON.stringify(obj, function(key, val) {
           if(val !== null && typeof val == 'object') {
                if(seen.indexOf(val) >= 0)
                    return;
                seen.push(val);
            }
            return val;
        }, 4);
    }

    /**
     * Emit to all or specifc type of known ports.
     *
     * Examples:
     *    panels.emit('panel.show') will emit to all ports.
     *    panels.emit('mainpanel', 'panel.show') will only emit to mainpanel.
     *    panels.emit('widget.indicator.start', 'queues') will emit to all.
     */
    var emit = exports.emit = function() {
        var args = Array.prototype.slice.call(arguments);
        var type = null;
        if(args.length > 1) {
            type = args[0];
        }

        var emit_to_ports = [];
        if(type && ports.hasOwnProperty(type)) {
            // just to ports for type
            emit_to_ports = ports[type];
            args.shift();
        } else {
            // emit to all ports
            for(var port_type in ports) {
                emit_to_ports = emit_to_ports.concat(ports[port_type]);
            }
        }
        // emit args
        if(!emit_to_ports.length) {
            console.warn('cannot emit to zero ports.');
        } else {
            if(type && ports.hasOwnProperty(type)) {
                console.log('emitting to type "' + type + '"');
            } else {
                console.log('emitting to all (' + emit_to_ports.length + ')');
            }
            if(typeof args == 'object') {
                console.log('emitting data: ' + _stringify(args));
            } else {
                console.log('emitting data: ' + args);
            }

            emit_to_ports.forEach(function(port) {
               port.emit.apply(null, args);
            });
        }
    };

    /**
     * Bind function on all or specifc type of known ports.
     */
    var on = exports.on = function(message, func, type) {
        var on_ports = [];
        if(type && ports.hasOwnProperty(type)) {
            // just listen on ports for type
            on_ports = ports[type];
        } else {
            if(type) {
                console.warn('no ports to bind on for type "' + type + '"');
            }

            // listen on all ports
            for(type in ports) {
                on_ports = on_ports.concat(ports[type]);
            }
        }
        // bind func
        if(!on_ports.length) {
            console.warn('cannot bind to zero ports.');
        } else {
            if(type && ports.hasOwnProperty(type)) {
                console.log('binding on type "' + type + '"');
            } else {
                console.log('binding on all (' + Object.keys(ports).length + ')');
            }
            console.log('binding: ' + message);

            on_ports.forEach(function(port) {
                port.on(message, func);
            });
        }
    };

    /**
     * Bind meesage listeners for given port and type.
     */
    var setHandlersOn = function(port, type) {
        port.on('broadcast', function() {
            // special message: repeat message to all ports
            emit.apply(null, arguments);
        });

        // attempt to log in
        port.on('login.attempt', function(username, password) {
            console.info('login.attempt');

            port.emit('login.indicator.start');

            login(username, password);
        });

        // keep track of opened/closed widgets
        port.on('widget.open', function(widget) {
            console.info('widget.open');

            storage.widgets.isOpen[widget] = true;
            timer.update('queue.size');
        });
        port.on('widget.close', function(widget) {
            console.info('widget.close');

            storage.widgets.isOpen[widget] = false;
            timer.update('queue.size');
        });

        port.on('logout.attempt', function() {
            console.info('logout.attempt');

            main.logout();
        });

        // refresh every widget and spin the icon while doing it
        port.on('refresh', function() {
            console.info('panel.refresh');

            port.emit('panel.refresh.start');
            refreshWidgets(true);
            port.emit('panel.refresh.stop');
        });

        // open the firefox plugin wiki page
        port.on('help', function() {
            console.info('mainpanel.help');

            tabs.open('http://wiki.voipgrid.nl/index.php/Firefox_plugin');
            mainpanel.hide();
        });

        // open the user change form on the platform
        port.on('settings', function() {
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

        // close panel (and force hide mainpanel)
        port.on('close', function() {
            console.info('panel.close');

            mainpanel.hide();
        });

        // dial given number
        port.on('clicktodial.dial', function(b_number, silent) {
            clicktodial.dial(b_number, silent);
        });

        // currently, there is no other way to support
        // localization in content scripts, so asynchronous
        // seems the best available option
        port.on('translate', function(messageID, options) {
            console.info('mainpanel.translate');

            var count, placeholder = null;
            if(options.hasOwnProperty('count')) {
                count = options.count;
            }
            if(options.hasOwnProperty('placeholder')) {
                placeholder = options.placeholder;
            }
            var translated = translate(messageID, count, placeholder);
            port.emit('translated', messageID, options, translated);
        });

        // bind for type 'mainpanel'
        if(type == 'mainpanel') {
            // set the panel's dimensions
            port.on('mainpanel.resize', function(size) {
                console.info('mainpanel.resize');

                mainpanel.resize(size.width, size.height);
            });

            // open the firefox plugin panel in a tab
            port.on('popout.show', function() {
                console.info('popout.show');

                tabs.open(data.url('panel/html/popout.html'));
                mainpanel.hide();
            });

            port.on('contacts.presence', function(reload) {
                console.info('mainpanel, contacts.presence');

                // resend last known connection status
                if(reload) {
                    // update presence subscriptions
                    sip.update(reload);
                } else {
                    // start polling for presence information for contacts
                    sip.start();
                }
            });
        }

        // bind for type 'popout'
        if(type == 'popout') {
            port.on('panel.onshow', function() {
                console.info('popout, panel.onshow');

                if(storage.user) {
                    // repeat events after success login
                    port.emit('login.success', storage.user);
                    port.emit('widget.close', 'contacts');
                    port.emit('widget.indicator.start', 'contacts');

                    if(storage.widgets.contacts.unauthorized) {
                        port.emit('widget.unauthorized', 'contacts');
                    } else {
                        // build contacts list for popout from cache
                        if(storage.widgets.contacts.list && storage.widgets.contacts.list.length) {
                            port.emit('contacts.reset');
                            port.emit('contacts.fill', storage.widgets.contacts.list, false);
                        } else {
                            port.emit('contacts.empty');
                        }
                    }

                    port.emit('widget.indicator.stop', 'contacts');
                }
            });

            port.on('contacts.presence', function(reload) {
                console.info('popout, contacts.presence');

                if(storage.widgets.contacts.status) {
                    port.emit('contacts.' + storage.widgets.contacts.status);

                    // use existing presence subscriptions
                    sip.update(false);
                }
            });
        }
    };

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
                storage.isMainPanelOpen = false;
                emit('mainpanel', 'panel.onhide');
                if(options.onHide) {
                    options.onHide();
                }
            },
            onShow: function() {
                storage.isMainPanelOpen = true;
                emit('mainpanel', 'panel.onshow');
            },
        });
        addPort(mainpanel.port, 'mainpanel');

        // initial state for mainpanel
        storage.isMainPanelOpen  = false;

        // copy popup functionality to panel/html/popout.html
        page.initPopout();

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
            emit('widget.close', widget);
            emit('widget.indicator.start', widget);
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
                        emit('login.indicator.stop');
                    },
                    onOk: function(response) {
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
                        emit('login.failed');
                    },
                }
            );
        });
    };
})();
