$(function() {
    var lastQueuesJson = null;
    var lastPanelJson = null;
    var lastContactsJson = null;

    var last_search_query = '';
    var search_query = '';

    var ContactViewModal = function(data){
        var that = this;

        that.status = ko.observable('status-icon available');

        that.name = ko.observable(data.description);
        that.extension = ko.observable(data.internal_number);
    };

    var QueueViewModal = function(data, primary){
        var that = this;

        that.itemClass = data.id == primary 
            ? 'selected' : '';

        that.itemTitle = data.id;
        that.itemText = data.description;

        that.indicatorId = 'size' + data.id;
        that.indicatorTitle = data.id;

        that.codeText = '(' + data.internal_number + ')';
    };

    var PanelViewModal = function(){
        var that = this;

        that.contacts = ko.observableArray([]);
        that.queues = ko.observableArray([]);

        that.AddContact = function(contact){
            that.contacts.push(ko.observable(contact));
        }

        that.AddQueue = function(queue){
            that.queues.push(ko.observable(queue));
        }

        that.ClearContacts = function(){
            that.contacts.removeAll();
        } 

        that.ClearQueues = function(){
            that.queues.removeAll();
        }
    };

    var panelViewModal = 
        new PanelViewModal();
    ko.applyBindings(panelViewModal);


    // close all widgets with data-opened="false"
    $('.widget[data-opened="false"] .widget-content').hide();

    var widgetIsOpenned = function(widget){
        return $(widget).parent().data('opened') === true;
    }

    var widgetClose = function(widget){
        $(widget).parent()
            .data('opened', false)
            .attr('data-opened', 'false')
            .find('.widget-content')
            .hide(200);
    };

    var widgetOpen = function(widget){
        $('html').addClass('scrollbarhide');

        $(widget).parent()
            .data('opened', true)            
            .attr('data-opened', 'true')
            .find('.widget-content')
            .show(200, function() {
                $('body').removeClass('scrollbarhide');
            });
    };

    var widgetIsQueues = function(widget){
        return $(widget).parent().hasClass('availability');
    };

    var widgetIsContacts = function(widget){
        return $(widget).parent().hasClass('hblf');
    };

    // a widget header click will minimize/maximize the widget's panel
    $('.widget .widget-header').on('click', function() {

        if(widgetIsContacts(this)){
            dump(widgetIsOpenned(this) + '\n');

            if($(this).find("input:focus").length > 0){
                widgetOpen(this);
                return;
            }
        }

        if(widgetIsOpenned(this)){
            widgetClose(this);
        }else{
            widgetOpen(this);
        }

        if(widgetIsQueues(this)){
            self.port.emit('change_queue_widget_status', 
                    widgetIsOpenned(this) ? 'opened' : 'closed');
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

    var upadateQueues = function(json){
        if(lastQueuesJson != json){
            lastQueuesJson = json;

            var showEmpty = function(){
                $('.empty-queue').css('display', 'block');
            };

            panelViewModal.ClearQueues();

            switch (json.type){
                case 'clear':{
                    showEmpty();
                    break;
                }
                case 'queues':{
                    if(json.queues.length == 0){
                        showEmpty();
                    }else{
                        for (var i in json.queues){
                            panelViewModal.AddQueue(new QueueViewModal(json.queues[i], json.primary));
                        }
                    }
                    break;
                }
            }
        }
    };

    var upadateContacts = function(json){
        dump('updatecontacts ' + '\n');

        if(lastContactsJson != json 
                || search_query != last_search_query){

            lastContactsJson = json;
            last_search_query = search_query;

            var showEmpty = function(){
                $('.empty-contacts').css('display', 'block');
            };

            panelViewModal.ClearContacts();

            switch (json.type){
                case 'clear':{
                    showEmpty();
                    break;
                }
                case 'contacts':{
                     if(json.contacts.length == 0){
                        showEmpty();
                    }else{
                        for(var i in json.contacts){
                            var query_exist = json.contacts[i]
                                    .description
                                    .toLowerCase()
                                    .indexOf(search_query) > -1;

                            if(query_exist){
                                panelViewModal.AddContact(new ContactViewModal(json.contacts[i]));
                            }
                        }
                    }
                }
            }
        }
    };

    // update the list of queue callgroups
    self.port.on('updatequeues', function(json) {
        upadateQueues(json);
    });

    // update the list of contacts callgroups
    self.port.on('updatecontacts', function(json) {
        upadateContacts(json);
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

    $('#search-query').keyup(function(){

        search_query = $(this)
            .val()
            .trim()
            .toLowerCase();

        upadateContacts(lastContactsJson);
    });

});
