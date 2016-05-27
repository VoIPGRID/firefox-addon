(function() {
    'use strict';

    var Request = require('sdk/request').Request;
    var storage = require('sdk/simple-storage').storage;

    var googleAnalyticsUrl = 'https://www.google-analytics.com/collect';
    var trackerId = 'UA-60726618-10';

    /**
     * A function that will POST an Click-to-Dial Event to Google Analytics.
     *
     * Args:
     *      origin (string): Where was the event generated (Colleagues/Webpage).
     */
    exports.trackClickToDial = function (origin) {
        var context = {
            ec: 'Calls',
            ea: 'Initiate ConnectAB',
            el: origin
        };

        _postData('event', context);
    };

    /**
     * POST data to Google Analytics.
     *
     * Args:
     *      type (string): type of measurement.
     *      context (obj): object with info to send to Google Analytics.
     */
    function _postData (type, context) {
        var content = {
            v: 1,
            t: type,
            tid: trackerId,
            cid: _getClientId(),
            uid: _getUserId(),
        };

        for (var attrName in context) {
            content[attrName] = context[attrName];
        }

        var content = _serialize(content);
        console.log('Post to GA: ' + content);

        new Request({
            url: googleAnalyticsUrl,
            content: content
        }).post();
    }

    /**
     * Get a unique clientId, either existing from localstorage or generate a new one.
     *
     * This id is rfc4122 version 4 compliant (random based).
     *
     * Returns:
     *      string: unique identifier.
     */
    function _getClientId () {
        if (!storage.uuid) {
            storage.uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        return storage.uuid;
    }

    /**
     * Get the client id of currently logged in user.
     *
     * If the user is not logged in, we return a -1 number.
     *
     * Returns:
     *      int: client_id of the user or -1.
     */
    function _getUserId () {
        if (storage.user) {
            return storage.user.client_id;
        } else {
            return -1;
        }
    }

    /**
     * Serialize object to query parameters.
     *
     * Credits:
     * http://stackoverflow.com/questions/1714786/querystring-encoding-of-a-javascript-object
     * 
     * Args:
     *      object (object): an object.
     *
     * Returns:
     *      string: queryparameter string of object.
     */
    function _serialize(object) {
        var str = [];
        for(var p in object)
            if (object.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(object[p]));
            }
        return str.join("&");
    }
})();
