/**
 * @inspiration: https://code.google.com/p/adblockforchrome/source/browse/trunk/functions.js
 */
(function() {
    'use strict';

    var localizedElements = [];

    /**
     * Currently, there is no other way to support
     * localization in content scripts, so asynchronous
     * is the best available option.
     * Therefor, this function will emit the event 'translate' and the
     * translation will come in through the event 'translated'.
     */
    window.translate = function(messageID, options) {
        self.port.emit('translate', messageID, options);
    };

    self.port.on('translated', function(messageID, options, translation) {
        var index = options.index;
        var element = localizedElements[index];
        var what = options.what;

        switch(what) {
            // translate html
            // case 'html':
            //     $(element).html(translation);
            //     break;

            // translate attribute
            case 'attr':
                var which = options.which;
                $(element).attr(which, translation);
                break;

            // shortcut to translate common attributes
            // case 'placeholder':
            //     $(element).attr('placeholder', translation);
            //     break;
            case 'title':
                $(element).attr('title', translation);
                break;
            // case 'val':
            //     $(element).val(translation);
            //     break;
        }

        // prevent translating elements multiple times
        if(element && !$(element).hasClass('l10n-replaced')) {
            $(element).addClass('l10n-replaced');
        }
    });

    $(function() {
        // // translate html
        // $('[data-l10n-html]')
        //     .not('.l10n-replaced').each(function() {
        //         localizedElements.push($(this).get(0));
        //         translate($(this).attr('data-l10n-html'), {
        //             what: 'html',
        //             index: localizedElements.length - 1,
        //         });
        // });

        // translate attributes
        $('[data-l10n-attrs]')
            .not('.l10n-replaced').each(function() {
                // example format:
                // <element data-l10n-attrs='{"attr-name": "messageID"}'>
                localizedElements.push($(this).get(0));
                var attrs = $(this).data('l10n-attrs');
                for(var attr in attrs) {
                    if(attrs.hasOwnProperty(attr)) {
                        translate(attrs[attr], {
                            what: 'attr',
                            which: attr,
                            index: localizedElements.length - 1,
                        });
                    }
                }
        });

        // shortcut to translate common attributes
        // $('[data-l10n-placeholder]')
        //     .not('.l10n-replaced').each(function() {
        //         localizedElements.push($(this).get(0));
        //         translate($(this).attr('data-l10n-placeholder'), {
        //             what: 'placeholder',
        //             index: localizedElements.length - 1,
        //         });
        // });
        $('[data-l10n-title]')
            .not('.l10n-replaced').each(function() {
                localizedElements.push($(this).get(0));
                translate($(this).attr('data-l10n-title'), {
                    what: 'title',
                    index: localizedElements.length - 1,
                });
        });
        // $('[data-l10n-val]')
        //     .not('.l10n-replaced').each(function() {
        //         localizedElements.push($(this).get(0));
        //         translate($(this).attr('data-l10n-val'), {
        //             what: 'val',
        //             index: localizedElements.length - 1,
        //         });
        // });
    });
})();
