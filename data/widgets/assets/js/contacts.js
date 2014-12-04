(function() {
    'use strict';

    var searchQuery = '',
        sipConfig;

    var blink = function() {
       $('.status-icon.ringing')
        .toggleClass('available')
        .toggleClass('busy');
    };
    setInterval(blink, 400);

    var fade = function() {
        var icon = $('.connecting.connection-icon:visible');
        if($(icon).css('opacity') === '0') {
            icon.fadeTo(400, 1.0);
        } else {
            icon.fadeTo(400, 0);
        }
    };
    setInterval(fade, 1000);

    $(function($) {
        self.port.on('contacts.connecting', function() {
            console.info('contacts.connecting');

            $('.contacts .connection-icon').hide()
                .filter('.connecting').css('display', 'inline-block');

            $('.contacts .status-icon')
                .removeClass('available unavailable busy ringing');
        });

        self.port.on('contacts.failed_to_start', function() {
            console.info('contacts.failed_to_start');

            $('.contacts .connection-icon').hide()
                .filter('.no-connection').css('display', 'inline-block');
        });

        self.port.on('contacts.connected', function() {
            console.info('contacts.connected');

            $('.contacts .connection-icon').hide();
        });

        self.port.on('contacts.disconnected', function() {
            console.info('contacts.disconnected');

            $('.contacts .connection-icon').hide()
                .filter('.connecting').css('display', 'inline-block');

            $('.contacts .status-icon')
                .removeClass('available unavailable busy ringing');
        });

        self.port.on('sip.state', function(account_id, state) {
            console.info('sip.state');

            $('#sip' + account_id + ' .status-icon')
                .removeClass('available unavailable busy ringing')
                .addClass(state);
        });

        self.port.on('contacts.reset', function() {
            var list = $('.contacts .list');
            list.empty();
            $('.widget.contacts .empty-list').addClass('hide');

            // reset search
            searchQuery = '';
            $('.search-form :input').val(searchQuery);
            $('.widget.contacts .contact').removeClass('hide');
        });

        self.port.on('contacts.empty', function() {
            $('.widget.contacts .empty-list').removeClass('hide');
            $('.contacts .search-query').attr('disabled', 'disabled');
        });

        // fill the contact list
        self.port.on('contacts.fill', function(contacts, update) {
            $('.widget.contacts .empty-list').addClass('hide');
            $('.contacts .search-query').removeAttr('disabled');

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

            // hack in popout to display bottom border
            $('.contacts .list .contact:visible:last').addClass('last');

            // receive presence data after the list is fully built
            self.port.emit('contacts.presence', update);

            // hide element
            $('embed').hide();

            window.resize();
        });

        // various callbacks for different states - these exist for the
        // sole purpose of passing the status to the background
        var startingCallback = function() {
            self.port.emit('sip.status', 'connecting');
        };
        var failedToStartCallback = function() {
            self.port.emit('sip.status', 'failed_to_start');
        };
        var startedCallback = function() {
            self.port.emit('sip.status', 'connected');
        };
        var stoppedCallback = function() {
            self.port.emit('sip.status', 'disconnected');
        };
        var initializeSIPmlCallback = function() {
            SIP.init(sipConfig);
        };

        function startSubscriptions() {
            // initialize SIPml if necessary
            if(SIPml.isInitialized()) {
                initializeSIPmlCallback();
            } else {
                SIPml.init(
                    initializeSIPmlCallback,
                    function(event) {
                        console.error('Failed to initialize the engine: ' + event.message);
                    }
                );
                SIPml.setDebugLevel('warn');  // supported values: info, warn, error and fatal.
            }
        }

        function updateSubscriptions(reload, contacts) {
            var account_ids = [];
            $(contacts).each(function(index, contact) {
                account_ids.push(''+contact.account_id);
            });
            SIP.refresh(account_ids, reload);
        }

        self.port.on('sip.start', function() {
            startSubscriptions();
        });

        self.port.on('sip.update', function(reload, account_ids) {
            console.info('sip.update');

            updateSubscriptions(reload, account_ids);
        });

        self.port.on('sip.config', function(_sipConfig) {
            console.info('sip.config');

            _sipConfig['callbacks'] = {
                starting: startingCallback,
                failed_to_start: failedToStartCallback,
                started: startedCallback,
                stopped: stoppedCallback,
            };
            sipConfig = _sipConfig;
        });

        self.port.on('sip.subscribe', function(account_id) {
            SIP.subscribe(account_id);
        });

        self.port.on('sip.stop', function() {
            console.info('sip.stop');

            SIP.stop();
        });

        // call a contact
        $('.contacts').on('click', '.status-icon, .name, .extension', function(e) {
            var extension = $(this).closest('.contact').find('.extension').text();
            if(extension && extension.length) {
                self.port.emit('clicktodial.dial', extension, true);
            }
        });

        // search form
        $('.search-form :input')
            // search while typing
            .keyup(function(){
                searchQuery = $(this).val().trim().toLowerCase();

                var list = $('.contacts .list');
                $(list).find('.contact.last').removeClass('last');

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
                    $('.widget.contacts .list').css('overflow-x', 'auto');
                    $('.widget.contacts .not-found-contacts').addClass('hide');
                    // hack in popout to display bottom border
                    $('.contacts .list .contact:visible:last').addClass('last');
                } else {
                    $('.widget.contacts .list').css('overflow-x', 'hidden');
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
