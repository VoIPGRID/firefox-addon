$(function() {
    var lastQueuesJson = null;
    var lastPanelJson = null;

    // close all widgets with data-opened="false"
    $('.widget[data-opened="false"] .widget-content').hide();

    // a widget header click will minimize/maximize the widget's panel
    $('.widget .widget-header').on('click', function() {
        var status = '';

        // check if it's closed or opened
        if($(this).parent().data('opened') === true) {
            $(this).parent()
                    .data('opened', false)
                    .attr('data-opened', 'false')
                    .find('.widget-content').hide(200);

            status = 'closed';
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

            status = 'opened';
        }

        dump('slider ' + status + '\n');

        if($(this).parent().find('#queue').length > 0){
            self.port.emit('change_queue_widget_status', status);
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
    self.port.on('updateform', function(type) {
        var elements = "";

        $('#form').empty();

        switch (type){
            case 'clear':{
                $('#body').css('display', 'block');
                $('#close').css('display', 'block');
                break;
            }
            case 'login':{

                $('#body').css('display', 'none');
                $('#close').css('display', 'none');

                var fildSet = $('<fieldset />');
                var table = $('<table />');

                var login = $('<input>');
                login.attr('id', 'username');
                login.attr('type', 'text');

                var password = $('<input>');
                password.attr('id', 'password');
                password.attr('type', 'password');

                table
                    .append($("<tr />")
                        .append($('<td>', { text: 'e-mailadres'}))
                        .append($('<td>')
                            .append(login)
                        ))
                    .append($("<tr />")
                        .append($('<td>', { text: 'wachtwoord'}))
                        .append($('<td>')
                            .append(password)
                        ));

                fildSet.append(table);

                var ul = $('<ul>', {'class': 'menu'});
                var li = $('<li>');
                var i = $('<i>', {'class': 'icon-signin'});

                li.attr('data-link', 'login');
                i.attr('id', 'login');

                ul.append(li.append(i).append('Inloggen'));

                $('#form').append(fildSet)
                    .append('<br />')
                    .append(ul);  
                break;
            }
        }
    });

    // update the heading which displays user info
    self.port.on('updatehead', function(text) {
            $('#head').text(text);
    });

    // update the list of queue callgroups
    self.port.on('updatequeues', function(json) {
        
        if(lastQueuesJson != json){

            lastQueuesJson = json;
            var queue = [];

            var applyQueue = function(){
                ko.applyBindings({'queue': queue});
            }

            var showEmpty = function(){
                $('.empty-queue').css('display', 'block');
            };

            switch (json.type){
                case 'clear':{
                    applyQueue();
                    showEmpty();
                    break;
                }
                case 'queues':{
                    if(json.queues.length == 0){
                        applyQueue();
                        showEmpty();
                    }else{
                        for (var i in json.queues){
                            var item = {
                                itemClass: json.queues[i]['id'] == json.primary ? 'selected' : '',
                                itemTitle: json.queues[i]['id'],
                                itemText: json.queues[i]['description'],

                                indicatorText: '?',
                                indicatorId: 'size' + json.queues[i]['id'],
                                indicatorTitle: json.queues[i]['id'],

                                codeText: '(' + json.queues[i]['internal_number'] + ')'
                            }

                            queue.push(item);
                        }

                        applyQueue();
                    }
                    break;
                }
            }
        }
    });

    // update the queue sizes in the list of queue callgroups
    self.port.on('updatequeuesize', function(size, id) {
        $('#size' + id).text(size);
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
    self.port.on('updatestatus', function(json) {

        if(lastPanelJson != json) {
            lastPanelJson = json;

            var elem = $('#statusupdate');
            elem.empty();

            var isCompleteFormat = json.fixedDestanations != null 
                    && json.phoneAccounts != null;

            if (!(isCompleteFormat) && json.fixedDestanations.length == 0 && json.phoneAccounts.length == 0) {
                elem.append($('<option>', {text: 'Je hebt momenteel geen bestemmingen.'}));
            }else {

                for (var i in json.fixedDestanations) {
                    f = json.fixedDestanations[i];
                    
                    var option = $('<option>', {text: f['phonenumber'] + '/' + f['description']});

                    if (f['id'] == json.selectedFixed) {
                        option.attr('selected', 'selected');
                    }

                    option.attr('id', 'fixed-' + f['id']);
                    option.attr('value', 'fixed-' + f['id']);

                    elem.append(option);
                }

                for (var i in json.phoneAccounts) {
                    p = json.phoneAccounts[i];
            
                    var option = $('<option>', {text: p['internal_number'] + '/' + p['description']});

                    if (p['id'] == json.selectedPhone) {
                        option.attr('selected', 'selected');
                    }

                    option.attr('id', 'phone-' + p['id']);
                    option.attr('value', 'phone-' + p['id']);

                    elem.append(option);
                }
            }
        }
    });

});
