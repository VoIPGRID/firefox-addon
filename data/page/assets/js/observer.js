(function() {
    'use strict';

    // regex to match dutch phone numbers
    var phoneRegex = /((\+31|00\s*31|0)\s*(\(0\))*)([-\s\.\(])*(([1-7]([-\s\.\)])*\d)|(8[58]))([-\s\.\)])*\d([-\s\.\)])*\d([-\s\.])*\d([-\s\.])*\d([-\s\.])*\d([-\s\.])*\d([-\s\.])*\d/g;

    // regex to match simple date format
    var dateRegex = /\d{2}-\d{2}-\d{4} \d{2}/g;

    // only look for phone numbers in child nodes of the following tags
    var selector = [
        "a", "abbr", "acronym", "address", "applet", "b", "bdo", "big", "blockquote", "body", "caption", "center",
        "cite", "dd", "del", "div", "dfn", "dt", "em", "fieldset", "font", "form", "h1", "h2", "h3", "h4",
        "h5", "h6", "i", "ins", "kdb", "li", "nobr", "object", "p", "q", "samp", "small", "span",
        "strike", "s", "strong", "sub", "sup", "td", "th", "tt", "u", "var", "article", "aside", "bdi", "command",
        "datalist", "details", "embed", "figure", "figcaption", "footer", "header", "hgroup", "keygen", "mark",
        "meter", "nav", "outpuFt", "progress", "rp", "ruby", "rt", "section", "summary", "time", "wbr"
    ].join(',');

    // identify our elements with these class names
    var phoneElementClassName = 'voipgrid-phone-number';
    var phoneIconClassName = 'voipgrid-phone-icon';

    // element that shows the icon and triggers a call
    var iconStyle = {
        'background-attachment': 'scroll',
        'background-color': 'transparent !important',
        'background-image': 'url("resource://voipgrid-at-jetpack/voipgrid/data/clicktodial/assets/img/clicktodial.png")',
        'background-repeat': 'no-repeat',
        'bottom': '-3px !important',
        'background-position': 'center center',
        '-moz-border-radius': '9px !important',
        'border-radius': '9px !important',
        '-moz-box-shadow': '0 1px 1px rgba(0, 0, 0, 0.2) !important',
        'box-shadow': '0 1px 1px rgba(0, 0, 0, 0.2) !important',
        'display': 'inline-block',
        'height': '18px !important',
        'margin': '0 4px !important',
        'line-height': '18px !important',
        'padding': '0 !important',
        'position': 'relative !important',
        'width': '18px !important',
    };

    // this icon will be cloned and slightly modified every time a phone number needs a new icon
    var icon = $('<a href="javascript:;">').addClass(phoneIconClassName)
        .attr('style', (function() {
            // cannot set !important with .css("property", "value !important"),
            // so build a string to use as style
            var style = '';
            for(var property in iconStyle) {
                style += property + ': ' + iconStyle[property] +'; ';
            }
            return style;
        }()));

    // this style's intention is to hide the icons when printing
    var printStyle = $('<link rel="stylesheet" href="resource://voipgrid-at-jetpack/voipgrid/data/page/assets/css/print.css" media="print">');

    /**
     * Click event handler: dial the number in $.data
     */
    $('body').on('click', '.'+phoneIconClassName, function(event) {
        if($(this).data('number') && $(this).parents('.'+phoneElementClassName).length) {
            // remove focus
            $(this).blur();

            // don't do anything with this click in the actual page
            event.preventDefault();
            event.stopPropagation();

            // dial
            self.port.emit('clicktodial.dial', $(this).data('number'));
        }
    });

    /**
     * Find elements that match our regex for a dutch phone number and
     * don't already have an icon next to them using *findAndReplaceDOMText*.
     */
    function insertIconsIntoElement(element) {
        stop_observer();

        findAndReplaceDOMText(element, {
            find: phoneRegex,
            replace: function(portion, match, matchIndex) {
                // return original text if there was "no text"
                if(!$.trim(portion.node.wholeText).length || portion.indexInNode < 0) {
                    return portion.text;
                }
                // insert the icon after the phone number
                var newIcon = icon.clone();
                newIcon.attr('data-number', match[0]);
                return $('<span>').addClass(phoneElementClassName).html(match[0] + $('<div>').append(newIcon).html())[0];
            },
            filterElements: function(element) {
                // apply date filter (to already matched elements only)
                var match = false, skip = false;
                for(var child = element.firstChild; child; child = child.nextSibling) {
                    if(phoneRegex.test(child.nodeValue)) {
                        match = true;
                        break;
                    }
                }
                if(match) {
                    if(dateRegex.test(element.innerHTML)) {
                        skip = true;
                    }
                }
                return !skip && !$(element).hasClass(phoneElementClassName);
            }
        });

        start_observer();
    }

    /**
     * Observer: search and insert icons after mutations.
     */
    var observer = new MutationObserver(function(mutations) {
        $.each(mutations, function(index, mutation) {
            insertIconsIntoElement(mutation.target);
        });
    });

    function start_observer() {
        if(observer) {
            observer.observe($('body')[0], {
                characterData: true,
                childList: true,
                subtree: true,
            });
        }
    }

    function stop_observer() {
        if(observer) {
            observer.disconnect();
        }
    }

    /**
     * Observer: start.
     */
    self.port.on('page.observer.start', function(message) {
        console.info('page.observer.start');

        // inject our print stylesheet
        $('head').append(printStyle);

        // only search the body element
        if($('body').length) {
            // process the DOM 'as is'
            insertIconsIntoElement($('body')[0]);

            // now also process mutations
            start_observer();
        }
    });

    /**
     * Observer: stop.
     */
    self.port.on('page.observer.stop', function(message) {
        console.info('page.observer.stop');

        // stop processing mutations
        stop_observer();

        // remove icons from page
        var iconElements = $('.'+phoneIconClassName);
        $(iconElements).remove();

        // remove our CSS class from previously identified elements containing phone numbers
        var phoneElements = $('.'+phoneElementClassName);
        $(phoneElements).contents().unwrap();

        // remove our stylesheet
        $(printStyle).remove();
    });

    // signal this script has been loaded and ready to look for phone numbers
    self.port.emit('page.observer.ready');
})();
