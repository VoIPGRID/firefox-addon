(function() {
    'use strict';

    // sdk
    var _ = require('sdk/l10n').get;

    /**
     * Find a localizated string for arguments.
     * @param {String} identifier   An identifier for the localization of a
     *                              particular string in the current locale.
     * @param {Integer} count       Optional parameter. If you're supplying
     *                              different localizations for a string for
     *                              singular or plural forms, this parameter
     *                              is the number of items there are in this
     *                              case.
     * @param {Strings} placeholder Optional parameters. If you do not include
     *                              the count parameter, you can supply one or
     *                              more placeholder strings that are to be
     *                              inserted into the translated string at
     *                              locations defined by the translator.
     * @return {String} Localized string.
     */
    exports.translate = function(identifier, count, placeholder) {
        return _(identifier, count, placeholder);
    };
})();
