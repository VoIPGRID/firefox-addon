(function() {
    'use strict';

    // very simple cache
    window.cache = {
        'dimensions': {
            'width': 360,
            'height': 0,
        }
    };
    window.resize = function() {
        var height = $('body').height();
        if(cache.dimensions.height != height) {
            // resize the panel to fit its content
            var size = {
                height: height - 1,
                width: cache.dimensions.width,
            };
            self.port && self.port.emit('mainpanel.resize', size);
        }
    };
    // always force a resize for this event
    self.port && self.port.on('mainpanel.onshow', function() {
        resize();
    });

    $(function($) {
        // run once when DOM ready
        window.resize();

        // show/hide the login form
        function showLoginForm() {
            $('.login-section').removeClass('hide');

            // reset the login form
            $('.login-form :input:visible').val('');
            resetButton();

            // focus the first input field
            $('.login-form :input:visible:first').focus();
        }
        function hideLoginForm() {
            $('.login-section').addClass('hide');
        }

        // show/hide the panel's content
        function showPanel() {
            $('.container').removeClass('hide');
        }
        function hidePanel() {
            $('.container').addClass('hide');
        }

        // capture keys in login form
        $('.login-form :input').keydown(function(e) {
            switch(e.which) {
                // cycle through proper fields with tab
                case 9:
                    var that = this;
                    var inputs = $('.login-form :input').filter(function(index, input) {
                        return that.tabIndex < input.tabIndex;
                    });

                    if(inputs.length === 0) {
                        $('#username').focus();
                    } else {
                        $(inputs[0]).focus();
                    }

                    e.preventDefault();
                    break;
                // login on enter
                case 13:
                    login();

                    e.preventDefault();
                    break;
            }

            if($('.login-button').hasClass('temporary-text')) {
                resetButton();
            }
        });

        // attempt to login
        function login() {
            // login when form is not empty
            if($('#username').val().trim().length && $('#password').val().length) {
                self.port && self.port.emit('login.attempt', $('#username').val().trim(), $('#password').val());
            }
        }

        // login with the button
        $('.login-button').click(function() {
            if($('.login-button').hasClass('temporary-text')) {
                resetButton();
            } else {
                login();
            }
        });

        // when logging in, display an indicator
        function busyLoginButton() {
            var button = $('.login-button');
            $(button).data('reset-text', $(button).html());
            $(button)
                .html($(button).data('loading-text'))
                .prop('disabled', true)
                .addClass('loading');
        }
        self.port && self.port.on('login.indicator.start', function() {
            busyLoginButton();
        });

        // reset the login indicator
        function resetButton() {
            var button = $('.login-button');
            $(button)
                .html($(button).data('reset-text'))
                .prop('disabled', false)
                .removeClass('loading')
                .removeClass('failed')
                .removeClass('info')
                .removeClass('temporary-text');
        }
        self.port && self.port.on('login.indicator.stop', function() {
            resetButton();
        });

        // show an error on login fail
        function failedLoginButton() {
            var button = $('.login-button');
            $(button)
                .html($(button).data('failed-text'))
                .prop('disabled', false)
                .addClass('failed')
                .addClass('temporary-text');
        }
        self.port && self.port.on('login.failed', function() {
            failedLoginButton();
        });

        // show a message on logout
        function loggedOutButton() {
            var button = $('.login-button');
            $(button)
                .html($(button).data('logout-text'))
                .prop('disabled', false)
                .addClass('info')
                .addClass('temporary-text');
        }
        self.port && self.port.on('logout', function() {
            hidePanel();
            showLoginForm();

            window.resize();
            loggedOutButton();
        });

        // after login, show the user's e-mail address
        self.port && self.port.on('login.success', function(user) {
            $('#user-name').text(user.email);

            hideLoginForm();
            showPanel();

            window.resize();
        });

        // capture icon clicks in the plugin container
        $('#logout').click(function(event) {
            self.port && self.port.emit('logout.attempt');
        });
        $('#help').click(function(event) {
            self.port && self.port.emit('help');
        });
        $('#settings').click(function(event) {
            self.port && self.port.emit('settings');
        });
        $('#close').click(function() {
            self.port && self.port.emit('close');
        });
    });
})();
