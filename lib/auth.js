(function() {
    'use strict';

    // sdk
    var passwords = require('passwords');

    // 1st party

    var url = 'https://partner.voipgrid.nl',
        formSubmitURL = null,
        realm = 'django-tastypie';

    /**
     * Store the username and password in the password manager so it can be
     * used throughout the active login session.
     */
    exports.storeCredentials = function(username, password, onComplete) {
        // if the password already exists, remove it
        passwords.search({
            // these three values identify the stored password
            url: url,
            formSubmitURL: formSubmitURL,
            realm: realm,

            onComplete: function(credentials) {
                credentials.forEach(passwords.remove);

                passwords.store({
                    // these three values identify the stored password
                    url: url,
                    formSubmitURL: formSubmitURL,
                    realm: realm,

                    username: username,
                    password: password,
                    onComplete: function() {
                        if(onComplete) {
                            onComplete();
                        }
                    },
                });
            },
        });
    };

    /**
     * Find and remove the password from the password manager.
     */
    exports.removeCredentials = function() {
        passwords.search({
            // these three values identify the stored password
            url: url,
            formSubmitURL: formSubmitURL,
            realm: realm,

            onComplete: function(credentials) {
                credentials.forEach(passwords.remove);
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
            // these three values identify the stored password
            url: url,
            formSubmitURL: formSubmitURL,
            realm: realm,

            onComplete: function(credentials) {
                if(credentials.length > 0){
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
