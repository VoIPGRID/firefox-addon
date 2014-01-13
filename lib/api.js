(function() {
    'use strict';

    // sdk
    var base64encode = require('sdk/base64').encode;
    var notify = require('sdk/notifications').notify;
    var prefs = require('sdk/simple-prefs');
    var storage = require('sdk/simple-storage').storage;
    var Request = require('sdk/request').Request;

    // 1st party
    var auth = require('./auth');
    var main = require('./main');

    // get all necessary headers for an API call
    function getHeaders(credentials) {
        return {
            'Content-type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Basic ' + base64encode(credentials.username + ':' + credentials.password),
        };
    }


    // get an url to send requests to
    exports.getUrl = function(api) {
        return {
            clicktodial: 'clicktodial/',
            phoneaccount: 'phoneaccount/phoneaccount/',
            queuecallgroup: 'queuecallgroup/',
            selecteduserdestination: 'selecteduserdestination/',
            systemuser: 'permission/systemuser/',
            userdestination: 'userdestination/',
        }[api];
    };

    // make an (asynchronous) api call
    exports.asyncRequest = function(path, content, requestMethod, callbacks) {
        console.info('calling api: ' + path);

        if(content) {
            content = JSON.stringify(content);
            console.info('using content: ' + content);
        }

        if(!callbacks.onError) {
            callbacks.onError = function() {
                console.info('error in retrieveCredentials');
            };
        }

        if(!callbacks.onUnauthorized) {
            callbacks.onUnauthorized = function(response) {
                // show this notification after being logged in once properly
                if(storage.user) {
                    // don't show more than once per login session
                    if(!storage.notifications.hasOwnProperty('unauthorized') || !storage.notifications['unauthorized']) {
                        notify({
                            // 'In order to use Click to Dial, you first need to log in by clicking the toolbar icon and entering your login details.'
                            text: 'Om gebruik te kunnen maken van Klik en Bel moet eerst ingelogd worden door op het icoontje op de toolbar te klikken en je gegevens in te vullen.'
                        });
                        storage.notifications['unauthorized'] = true;
                    }

                    main.logout();
                }

                if(callbacks.onNotOk) {
                    callbacks.onNotOk(response);
                }
            };
        }

        auth.retrieveCredentials(function(credentials) {
            var platformUrl = prefs.prefs['platform_url'];
            if(prefs.prefs['platform_url'].length && prefs.prefs['platform_url'].lastIndexOf('/') != prefs.prefs['platform_url'].length - 1) {
                // force trailing slash
                platformUrl = platformUrl + '/';
            }

            new Request({
                url: platformUrl + 'api/' + path,
                content: content,
                headers: getHeaders(credentials),
                onComplete: function(response) {
                    if(callbacks.onComplete) {
                        callbacks.onComplete();
                    }

                    console.info('response status code: ' + response.status);
                    switch(response.status) {
                        case 200:
                        case 201:
                        case 204:
                            if(callbacks.onOk) {
                                callbacks.onOk(response);
                            }
                            break;
                        case 401:  // failed to authenticate
                            if(callbacks.onUnauthorized) {
                                callbacks.onUnauthorized(response);
                            } else {
                                if(callbacks.onNotOk) {
                                    callbacks.onNotOk(response);
                                }
                            }

                            // if not logged out by callbacks, log out here
                            if(storage.user) {
                                main.logout();
                            }

                            break;
                        case 403:  // not the right permissions
                            if(callbacks.onForbidden) {
                                callbacks.onForbidden(response);
                            } else {
                                if(callbacks.onNotOk) {
                                    callbacks.onNotOk(response);
                                }
                            }
                            break;
                        default:
                            if(callbacks.onNotOk) {
                                callbacks.onNotOk(response);
                            }
                    }
                }
            })[requestMethod]();
        }, callbacks.onError);
    };
})();
