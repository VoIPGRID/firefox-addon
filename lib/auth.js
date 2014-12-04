(function() {
    'use strict';

    // sdk
    var passwords = require('sdk/passwords');

    // 1st party
    var api = require('./api');

    var realm = 'firefox add-on';

    /**
     * Store the username and password in the password manager so it can be
     * used throughout the active login session.
     */
    exports.storeCredentials = function(username, password, onComplete) {
        // overwrite existing credentials
        removeCredentials(function(credentials) {
            passwords.store({
                username: username,
                password: password,
                url: api.getPlatformUrl(),
                realm: realm,
                onComplete: function() {
                    if(onComplete) {
                        onComplete();
                    }
                },
            });
        });
    };

    /**
     * Find and remove the password from the password manager.
     */
    var removeCredentials = exports.removeCredentials = function(onComplete) {
        passwords.search({
            url: api.getPlatformUrl(),
            realm: realm,

            onComplete: function(credentials) {
                credentials.forEach(passwords.remove);
                if(onComplete) {
                    onComplete();
                }
            },
        });
    };

    /**
     * Retrieve credentials from password manager.
     * The trick here is that you can only use these credentials in an
     * asynchronous callback.
     */
    exports.retrieveCredentials = function(onSuccess, onFailed) {
        passwords.search({
            url: api.getPlatformUrl(),
            realm: realm,

            onComplete: function(credentials) {
                if(credentials.length) {
                    if(onSuccess) {
                        onSuccess(credentials[0]);
                    }
                } else {
                    if(onFailed) {
                        onFailed();
                    }
                }
            },
        });
    };
})();
