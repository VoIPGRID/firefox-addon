$(function() {
    // close all widgets with data-opened="false"
    $('.widget[data-opened="false"] .widget-content').hide();

    // a widget header click will minimize/maximize the widget's panel
    $('.widget .widget-header').on('click', function() {
        // check if it's closed or opened
        if($(this).parent().data('opened') === true) {
            $(this).parent()
                    .data('opened', false)
                    .attr('data-opened', 'false')
                    .find('.widget-content').hide(200);
        }
        else {
            // hide the scrollbar while resizing
            $('html').addClass('scrollbarhide');
            $(this).parent()
                    .data('opened', true)            
                    .attr('data-opened', 'true')
                    .find('.widget-content').show(200, function() {
                        // get back the scrollbar after resizing
                        $('body').removeClass('scrollbarhide');
                    });
        }
    });

    // widget select a li
    $('.widget.queues').on('click', 'li', function() {
        if($(this).attr('title') != undefined) {
            $(this).siblings().removeClass('selected');
            if($(this).attr('class') == 'selected') {
                $(this).removeClass('selected');
                self.port.emit('setprimary', '');
            }
            else {
                $(this).addClass('selected');
                self.port.emit('setprimary', $(this).attr('title'));
            }
        }
    }); 
    
    // detect changes in html and resize the plugin 
    $('body').on('DOMSubtreeModified', function() {
        var oHeight = $(this).outerHeight();

        if(oHeight  != null ) {

            self.port.emit('resize', { height: oHeight });

            // dump('DOMSubtreeModified resize emit, height: ' + oHeight + '\n');
        };

    }).trigger('DOMSubtreeModified');

    // handle statusupdate inputs
    $('input[name=availability]').change(function() {
        if($(this).val() == 'yes') {
            $('#statusupdate').removeAttr('disabled');
            self.port.emit('setuserdestination', $('#statusupdate option:selected').val());
        }
        else {
            $('#statusupdate').attr('disabled', 'disabled');
            self.port.emit('setuserdestination', null);
        }
    });
    $('#statusupdate').change(function() {
        self.port.emit('selectuserdestination', $('#statusupdate option:selected').val());
    });

    // handle button clicks
    window.addEventListener('click', function(event) {
        if(event.target.id == 'login') {
            self.port.emit('login', $('#username').val(), $('#password').val());
        }
        else if(event.target.id == 'logout') {
            self.port.emit('logout');
        }
        else if(event.target.id == 'help') {
            self.port.emit('help');
        }
        else if(event.target.id == 'settings') {
            self.port.emit('settings');
        }
        else if(event.target.id == 'close') {
            self.port.emit('close');
        }
    }, false);

    // always resize the panel properly when shown
    self.port.on('resizeonshow', function() {
        var oHeight = $('body').outerHeight()

        if(oHeight != null) {
            self.port.emit('resize', { height: oHeight });

            dump('resizeonshow resize emit, height: ' + oHeight + '\n');
        }
    });

    // hide or display the login form
    self.port.on('updateform', function(html) {
        if(html) {
            $('#body').attr('style', 'display:none');
            $('#close').attr('style', 'float:right;cursor:pointer;display:none');
        }
        else {
            $('#body').attr('style', 'display:block');
            $('#close').attr('style', 'float:right;cursor:pointer;display:block');
        }
        $('#form').html(html);
    });

    // update the heading which displays user info
    self.port.on('updatehead', function(html) {
        $('#head').html(html);
    });

    // update the list of queue callgroups
    self.port.on('updatelist', function(html) {
        $('#queue').html(html);
    });

    // update the queue sizes in the list of queue callgroups
    self.port.on('updatequeuesize', function(size, id) {
        $('#size' + id).html(size);
    });

    // set 'no' as selected radio input and disable statusupdate radio inputs
    self.port.on('nouserdestinations', function() {
        $('#no').attr('checked', true);
        $('#no').attr('disabled', 'disabled');
        $('#yes').attr('disabled', 'disabled');
    });
    // enable statusupdate radio inputs
    self.port.on('enableuserdestinations', function() {
        $('#no').removeAttr('disabled');
        $('#yes').removeAttr('disabled');
    });

    // set 'no' as selected radio input and disable statusupdate select input
    self.port.on('noselecteduserdestination', function() {
        $('#no').attr('checked', true);
        $('#statusupdate').attr('disabled', 'disabled');
    });

    // update the select element with userdestinations
    self.port.on('updatestatus', function(html) {
        $('#statusupdate').html(html);
    });
});
