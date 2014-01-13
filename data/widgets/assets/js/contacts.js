(function() {
    'use strict';

    window.cache['contacts'] = {
        'list': [],
    };

    var searchQuery = '',
        phoneAccounts = [],
        subscribedTo = {};

    var blink = function() {
       $('.status-icon.ringing')
        .toggleClass('available')
        .toggleClass('busy');
    };
    setInterval(blink, 300);

    $(function($) {
        self.port && self.port.on('contacts.reset', function(user) {
            var list = $('.contacts .list');
            list.empty();
            $('.widget.contacts .empty-list').addClass('hide');

            if(!user) {
                searchQuery = '';
                phoneAccounts = [];
                subscribedTo = {};
            }
        });

        self.port && self.port.on('contacts.empty', function() {
            $('.widget.contacts .empty-list').removeClass('hide');
            $('.contacts .search-query').attr('disabled', 'disabled');
        });

        // fill the contact list
        self.port && self.port.on('contacts.fill', function(contacts) {
            $('.widget.contacts .empty-list').addClass('hide');
            $('.contacts .search-query').removeAttr('disabled');

            if(cache.contacts.list == contacts) {
                // no changes so exit early
                console.info('no new contacts');
                return;
            }
            // update cache
            cache.contacts.list = contacts;

            // clear list
            var list = $('.contacts .list');
            list.empty();

            // fill list
            var template = $('.contacts .template .contact');
            $.each(contacts, function(index, contact) {
                var listItem = template.clone();
                listItem.attr('id', 'sip' + contact.account_id);
                listItem.find('.name').text(contact.description);
                listItem.find('.extension').text(contact.internal_number);

                listItem.appendTo(list);
            });

            window.resize();
        });

        // subscribe to presence updates for account_id
        function subscribe(account_id) {
            var presenceCallback = function(impu, state) {
                console.info('contacts.updatePresence');

                var match = impu.match(/(.*)@/g);
                if(match.length) {
                    var start_pos = 0;
                    if(match[0].indexOf('sip:') === 0) {
                        start_pos = 4;
                    }
                    var selector = match[0].substring(start_pos, match[0].length-1);
                    $('#sip' + selector).find('.status-icon')
                        .removeClass('available unavailable busy ringing')
                        .addClass(state);

                    if(subscribedTo[account_id]) {
                        subscribedTo[account_id]['state'] = state;  // update cached presence
                    }
                }
            };

            // remember subscribed accounts and its state at the time of an update
            subscribedTo[account_id] = {
                state: null,
            };

            var impu = 'sip:'+ account_id + '@' + window.SIPconfig['realm'];
            window.SIP.subscribe(impu, presenceCallback);
        }

        // stop receiving presence updates for account_id
        function unsubscribe(account_id) {
            var impu = 'sip:'+ account_id + '@' + window.SIPconfig['realm'];
            window.SIP.unsubscribe(impu);
            delete subscribedTo[account_id];
        }

        // start polling for presence information
        self.port && self.port.on('sip.init', function(email, token) {

            var readyCallback = function(event) {
                var connectedCallback = function() {
                    $.each(cache.contacts.list, function(index, contact) {
                        subscribe(''+contact.account_id);
                    });
                };
                window.SIP.init({connected: connectedCallback});
                window.SIP.start();
            };
            var errorCallback = function(event) {
                console.error('Failed to initialize the engine: ' + event.message);
            };

            if(window.SIPml.isInitialized()) {
                console.info('SIPml already initialized, calling readyCallback immediately');
                readyCallback();
            } else {
                // update impi, pass and impu for SIP
                window.SIPconfig['impi'] = email;
                window.SIPconfig['pass'] = token;
                window.SIPconfig['impu'] = 'sip:' + window.SIPconfig['impi'] + '@' + window.SIPconfig['realm'];

                window.SIPml.init(readyCallback, errorCallback);
                window.SIPml.setDebugLevel('warn');  // supported values: info, warn, error and fatal.
            }

            // hide sip element
            $('embed').hide();
        });

        self.port && self.port.on('sip.update', function() {
            console.info('sip.update');

            var cachedAccountIds = [];
            $.each(cache.contacts.list, function(index, contact) {
                cachedAccountIds.push(''+contact.account_id);
            });

            // subscribe to accounts previously not in the list
            var toSubscribe = $(cachedAccountIds).not(Object.keys(subscribedTo)).get();
            $.each(toSubscribe, function(index, account_id) {
                subscribe(account_id);
            });

            // unsubscribe from accounts no longer in the list
            var toUnsubscribe = $(Object.keys(subscribedTo)).not(cachedAccountIds).get();
            $.each(toUnsubscribe, function(index, account_id) {
                unsubscribe(account_id);
            });

            // restore state from before the update
            $.each(Object.keys(subscribedTo), function(index, account_id) {
                $('#sip' + account_id).find('.status-icon')
                    .removeClass('available unavailable busy ringing')
                    .addClass(subscribedTo[account_id]['state']);
            });
        });

        // start polling for presence information
        self.port && self.port.on('sip.start', function() {
            if(window.SIP) {
                window.SIP.start();
            }
        });

        // stop polling for presence information
        self.port && self.port.on('sip.stop', function() {
            if(window.SIP) {
                window.SIP.stop();
            }
        });

        // call an available contact
        $('.contacts').on('click', '.status-icon.available:not(.ringing)', function() {
            var extension = $(this).closest('.contact').find('.extension').text();
            if(extension && extension.length) {
                self.port && self.port.emit('clicktodial.dial', extension, true);
            }
        });

        // search form
        $('.search-form :input')
            // search while typing
            .keyup(function(){
                searchQuery = $(this).val().trim().toLowerCase();

                var list = $('.contacts .list');

                // filter list
                $.each($('.contacts .contact'), function(index, contact) {
                    // hide contact if not a match
                    if($(contact).find('.name').text().toLowerCase().indexOf(searchQuery) == -1 && $(contact).find('.extension').text().toLowerCase().indexOf(searchQuery) == -1) {
                        $(contact).addClass('hide');
                    } else {
                        $(contact).removeClass('hide');
                    }
                });

                // show a message if no contacts matched
                if($('.contacts .contact:visible').length) {
                    $('.widget.contacts .not-found-contacts').addClass('hide');
                } else {
                    $('.widget.contacts .not-found-contacts').removeClass('hide');
                }

                window.resize();
            })
            // don't submit this form on enter
            .keydown(function(e){
                if(e.which === 13) {
                    e.preventDefault();
                }
            });
    });
})();
