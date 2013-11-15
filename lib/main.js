/* addon sdk apis */
const btoa = require("api-utils/base64").encode;
const contextmenu = require('context-menu');
const data = require('self').data;
const panel = require('panel').Panel;
const prefs = require('simple-prefs');
const request = require('request').Request;
const selection = require('selection');
const storage = require('simple-storage').storage;
const timer = require('timers');
const passwords = require('passwords');
const tabs = require('tabs');
const utils = require('utils');
const system = require('system');
/* voipgrid apis */
const clicktodialresource = 'clicktodial';
const queueresource = 'queuecallgroup';
const phoneaccountsource = 'phoneaccount';
const selecteduserdestinationresource = 'selecteduserdestination';
const userdestinationresource = 'userdestination';

var callgroup_ids = new Array();
var callid = '';
var clicktodialpanel;
var client_id = '';
var dialed_number = '';
var mainpanel;
var platform_url = '';
var selected_fixed = null;
var selected_phone = null;
var selecteduserdestination_id = '';
var status_timer = '';
var toolbarbutton;
var user_id = '';

var queue_timer = '';

var is_queue_selected = false;
var is_queue_showed = false;
var is_user_auth = false;
var is_panel_open = false;

var host_name = 'chrome://voipgrid';
var form_submit_url = null;
var user_login_realm = 'User Login';

exports.main = function(options) {
    platform_url = prefs.prefs['platform_url'];

    dump(system.id + '\n');

    // if the api url is changed in the prefs, re-initialize the panel
    prefs.on('platform_url', function(prefname) {
        platform_url = prefs.prefs['platform_url'];
        dump('platform url: ' + platform_url + '\n');
        loadpaneldata();
    });

    require('page-mod').PageMod({
        include: '*',
        contentScriptWhen: 'ready',

        contentScriptFile: [
            data.url('assets/js/jquery.js'), 
            data.url('assets/js/listener.js')
        ],
        
        onAttach: function(worker) {
            worker.port.on("is_observe_start", function(){
                if(prefs.prefs['click_to_dial_enabled']){
                    worker.port.emit('start_observe');
                }
            });

            worker.port.on('click', function(b_number) {
                clicktodial(b_number);
            });
        }
    });

    // create panel
    mainpanel = panel({
        width: 360,
        height: 10,
        contentScriptFile: [
            data.url('assets/js/jquery.js'), 
            data.url('assets/js/knockout.js'),

            data.url('assets/js/phoneaccount.js'),
            data.url('assets/js/SIPml-config.js'),
            data.url('assets/js/SIPml-api.js'),
            data.url('assets/js/SIP.js'),

            data.url('assets/js/panel.js')
        ],
        contentURL: data.url('panel.html'),
        onHide: function(){
            is_panel_open = false;
            startQueueTimer();
        },

        onShow: function(){
            is_panel_open = true;
            startQueueTimer();

            mainpanel.port.emit('resizeonshow');
        }
    });

    // resize the panel (for now only the height)
    mainpanel.port.on('resize', function(size) {
        mainpanel.resize(mainpanel.width, size);
    });
    // set username and password, use password manager
    mainpanel.port.on('login', function(user, pass) {
        login(user, pass);
    });
    // clear username and password and show the login form
    mainpanel.port.on('logout', function() {
        mainpanel.port.emit('updatehead', 'Uitgelogd'); // 'Logged out'
        logout();
    });
    // open the firefox plugin wiki page
    mainpanel.port.on('help', function() {
        require('tabs').open('http://wiki.voipgrid.nl/index.php/Firefox_plugin');
        mainpanel.hide();
    });
    // open the user change form on the voipgrid platform
    mainpanel.port.on('settings', function() {
        url = platform_url + 'client/' + client_id + '/user/' + user_id + '/change/#tabs-3';
        require('tabs').open(url);
        mainpanel.hide();
    });
    // just closes the panel
    mainpanel.port.on('close', function() {
        mainpanel.hide();
    });
    // set primary callgroup and close panel
    mainpanel.port.on('setprimary', function(id) {
        storage.primary = id;
        getqueuesizes();

        if(id != ''){
            is_queue_selected = true;
        }else{
            is_queue_selected = false;
        }

        startQueueTimer();

        if (id == '') {
            if (selected_fixed == null && selected_phone == null) {
                toolbarbutton.setIcon({url: data.url('assets/img/call-red.png')});
            }
            else {
                toolbarbutton.setIcon({url: data.url('assets/img/call-green.png')});
            }
        }
    });
    // create toolbarbutton
    toolbarbutton = require('toolbarbutton').ToolbarButton({
        id: 'queuesize',
        label: 'Queue size',
        image: data.url('assets/img/call-gray.png'),
        panel: mainpanel
    });
    // put toolbarbutton on nav-bar
    toolbarbutton.moveTo({
        toolbarID: 'nav-bar',
        forceMove: false
    });
    // on change of the userdestination select input, set the selected userdestination and hide the main panel.
    mainpanel.port.on('selectuserdestination', function(value) {
        selectuserdestination(value.split('-')[0], value.split('-')[1]);
    });
    // handle clicking on 'yes' or 'no'
    mainpanel.port.on('setuserdestination', function(value) {
        // on selecting the 'no' radio button, set the selected userdestination to None.
        if(value == null) {
            selectuserdestination(null, null);
        }
        // on selecting 'yes', set the userdestination to the value of the userdestination select input.
        else {
            selectuserdestination(value.split('-')[0], value.split('-')[1]);
        }
    });
    // change queue widget status
    mainpanel.port.on('change_queue_widget_status', function(status){
        switch(status){
            case 'closed': is_queue_showed = false;
                break;
            case 'opened': is_queue_showed = true;
                break;
        }

        startQueueTimer();
    });
    // sip stack started, loading contact list
    mainpanel.port.on('sip_stack_started', function(){

        var callbackComplete = function(credentials){

            var base64auth = 'Basic ' + btoa
                    (credentials.username + ':' + credentials.password);

            loadcontactsdata(base64auth);
        };

        var callbackError = function(){
            logout();
        }

        getCredentials(callbackComplete, callbackError); 
    })
    // add context menu item to dial selected number
    var menuitem = contextmenu.Item({
        label: 'Bel geselecteerde nummer', // 'Call selected number'
        context: contextmenu.SelectionContext(),

        contentScriptFile: [
            data.url('assets/js/jquery.js'), 
            data.url('assets/js/selection.js')
        ],
        
        onMessage: function(number) {
            number = number.replace('(0)', '').replace(/[- \.\(\)]/g, '');
            clicktodial(number);
        }
    });
    // initially display the login form. the loadpaneldata() call below hides it again if all is well.
    is_queue_showed = false;
    is_user_auth = false;

    startQueueTimer();

    mainpanel.port.emit('updateform', 'login');
    loadpaneldata();
};

function getQueueTimeout(){
    if(!is_user_auth){
        return  0;
    }else{
        if(is_panel_open){
            if(is_queue_showed){
                return 5000;
            }else{
                if(is_queue_selected){
                    return 20000;
                }else{
                    return 0;
                }
            }
        }else{
            if(is_queue_selected){
                return 20000;
            }else{
                return 0;
            }
        }
    }
}


function startQueueTimer(){
    timer.clearInterval(queue_timer);
    var timeout = getQueueTimeout();

    if(timeout > 0){
        getqueuesizes();

        queue_timer = timer
            .setInterval(getqueuesizes, timeout);
    }
}


// get cridentials from password manager
function getCredentials(complete, error){
    passwords.search({
        url: platform_url,
        formSubmitURL: form_submit_url,
        realm: user_login_realm,

        onComplete: function onComplete(credentials) {
            if(credentials.length > 0){
                complete(credentials[0]);
                return;
            }

            error();
        },
        
        onError: function onError(ex){
            error();
        }
    });
}

function login(username, password){
    passwords.store({
        url: platform_url,
        formSubmitURL: form_submit_url,
        realm: user_login_realm,
        username: username,
        password: password,

        onComplete: function onComplete(){
            loadpaneldata();
            mainpanel.port.emit('sip_start');
        },

        onError: function onError(ex){
            logout();
            mainpanel.port.emit('sip_stop');
        }
    });
}

function logout() {
    passwords.search({
        url: platform_url,
        formSubmitURL: form_submit_url,
        realm: user_login_realm,
        
        onComplete: function onComplete(credentials) {
            credentials.forEach(passwords.remove);
            displayloginform();
            mainpanel.port.emit('sip_stop');
        },

        onError: function onError(ex){
            displayloginform();
            mainpanel.port.emit('sip_stop');
        }
    });
}

/* handles clicktodial: initiates a call and shows the clicktodial panel. */
function clicktodial(b_number) {
    dialed_number = b_number;

    var callbackComplete = function(credentials){

        var base64auth = 'Basic ' + btoa(credentials.username + ':' + credentials.password);
        var content = JSON.stringify({ b_number: b_number.replace(/[^0-9+]/g, '') });

        request({
            url: platform_url + 'api/' + clicktodialresource + '/',
            content: content,
            headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
            onComplete: function (response) {
                if (response.json != null && response.json['callid'] != null) {
                    // display the clicktodialpanel only if we have a callid
                    callid = response.json['callid'];

                    status_timer = timer.setInterval(updatestatus, 500);

                    clicktodialpanel = panel({
                        width: 302,
                        height: 85,
                        contentScriptFile: [
                            data.url('assets/js/jquery.js'), 
                            data.url('assets/js/clicktodialpanel.js')
                        ],
                        contentURL: data.url('clicktodial.html'),
                        onHide: function() {
                            timer.clearInterval(status_timer);
                            clicktodialpanel.hide();
                        }
                    });

                    clicktodialpanel.port.on('close', function() {
                        timer.clearInterval(status_timer);
                        clicktodialpanel.hide();
                    });

                    clicktodialpanel.port.emit('updatenumber', b_number);
                    clicktodialpanel.show();
                }
                else {
                    require('notifications').notify({
                        text: 'Het is niet gelukt om het gesprek op te zetten.', // 'The call could not be set up.'
                        iconURL: data.url('clicktodial.gif')
                    });
                }
            }
        }).post();
    }
    
    var callbackError = function(){
        require('notifications').notify({
            text: 'Om gebruik te kunnen maken van Klik en Bel moet eerst ingelogd worden, door op het icoontje op de ' +
                    'toolbar te klikken en je gegevens in te vullen.',
            // 'In order to use Click to Dial, you first need to log in by clicking the toolbar icon and entering your details.'
            iconURL: data.url('clicktodial.gif')
        });
    };

    getCredentials(callbackComplete, callbackError);
}

/* when no valid username or password is entered: displays a login form and resets values and the icon */
function displayloginform() {
    client_id = '';
    user_id = '';
    selecteduserdestination_id = '';
    mainpanel.port.emit('updateform', 'login');
    mainpanel.port.emit('updatequeues', {type: 'clear'});

    mainpanel.port.emit('clear-contact-list');

    is_queue_showed = false;
    is_user_auth = false;

    startQueueTimer();

    toolbarbutton.setIcon({url: data.url('assets/img/call-gray.png')});
}


/* fills the queue list with queue sizes */
function getqueuesizes() {

    var callbackComplete = function(credentials) {
        var base64auth = 'Basic ' + btoa(credentials.username + ':' + credentials.password);
        for (var i in callgroup_ids) {
            // do a request for each callgroup
            request({
                url: platform_url + 'api/' + queueresource + '/' + callgroup_ids[i] + '/',
                headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
                onComplete: function(response) {
                    if (response.status == 200) {
                        // update list item for this specific callgroup
                        var queue_size = response.json['queue_size'];
                        var number = parseInt(queue_size);
                        if (isNaN(number)) {
                            queue_size = '?'; // queue size is not available
                        }
                        if (response.json['id'] == storage.primary) {
                            var filename = 'assets/img/queue10.png';
                            if (isNaN(number)) {
                                filename = 'assets/img/queue.png';
                            }
                            else if (number < 10) {
                                filename = 'assets/img/queue' + number + '.png';
                            }
                            toolbarbutton.setIcon({url: data.url(filename)});
                        }
                        mainpanel.port.emit('updatequeuesize', queue_size, response.json['id']);
                    }
                }
            }).get();
        }
    }
    
    var callbackError = function() {
        toolbarbutton.setIcon({url: data.url('assets/img/call-gray.png')});
    }

    getCredentials(callbackComplete, callbackError);
}

/* constructs select input of userdestinations and sets up queue list with a list of callgroups */
function loadpaneldata() {

    var callbackComplete = function(credentials) {
        var base64auth = 'Basic ' + btoa(credentials.username + ':' + credentials.password);
        // fetch userdestination info
        request({
            url: platform_url + 'api/' + userdestinationresource + '/',
            headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
            onComplete: function(response) {
                var someErrorStatusText = 'Je gebruikersnaam en/of wachtwoord is onjuist.';

                if (response.status == 200) {
                    var userDestinations = response.json.objects[0];

                    if (userDestinations == null || userDestinations.length == 0) {
                        // 'Your username and/or password is incorrect.'
                        mainpanel.port.emit
                            ('updatehead', someErrorStatusText); 

                        logout();
                    }
                    else {
                        client_id = userDestinations['client'];
                        user_id = userDestinations['user'];
                        selecteduserdestination_id = userDestinations['selecteduserdestination']['id'];

                        selected_fixed = userDestinations['selecteduserdestination']['fixeddestination'];
                        selected_phone = userDestinations['selecteduserdestination']['phoneaccount'];

                        // construct select input of userdestinations
                        var json = {
                            clientId: client_id,
                            userId: user_id,

                            selectedId: selecteduserdestination_id,
                            selectedFixed: selected_fixed,
                            selectedPhone: selected_phone,

                            fixedDestanations: userDestinations['fixeddestinations'],
                            phoneAccounts: userDestinations['phoneaccounts']
                        }

                        
                        if(json.selectedFixed == null && json.selectedPhone == null) {
                            // set 'no' as selected radio input and disable statusupdate select input
                            mainpanel.port.emit('noselecteduserdestination');
                        }

                        if (json.fixedDestanations.length == 0 && json.phoneAccounts.length == 0) {
                            // 'You have no destinations at the moment.'
                            mainpanel.port.emit('nouserdestinations');
                        } else {
                            // make sure the radio inputs are enabled
                            mainpanel.port.emit('enableuserdestinations');
                        }

                        if (json.selectedFixed == null && json.selectedPhone == null) {
                            toolbarbutton.setIcon({url: data.url('assets/img/call-red.png')});
                        }  else {
                            toolbarbutton.setIcon({url: data.url('assets/img/call-green.png')});
                        }


                        is_user_auth = true;
                        startQueueTimer();

                        mainpanel.port.emit('updateform', 'clear');

                        mainpanel.port.emit('updatehead', credentials.username);
                        mainpanel.port.emit('updatestatus', json);

                        // the user destinations have been loaded succesfully. we may fetch the queue list now.
                        loadqueuedata(base64auth);
                    }
                }
                else if (response.status == 401) {
                    // 'Your username and/or password is incorrect.'
                    mainpanel.port.emit
                        ('updatehead', someErrorStatusText); 

                    logout();
                }
            }
        }).get();
    }

    getCredentials(callbackComplete, function(){});
}

/* fetches queue info and loads them into the list on the main panel */
function loadqueuedata(base64auth) {
    request({
        url: platform_url + 'api/' + queueresource + '/',
        headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
        onComplete: function(response) {
            if (response.status == 200) {
                var queues = response.json.objects;

                mainpanel.port.emit('updatequeues', 
                    {type: 'queues', queues: queues, primary: storage.primary});

                if(queues.length != 0){
                    callgroup_ids = new Array();

                    for (var i in queues) {
                        callgroup_ids.push(queues[i]['id']);
                    }
                }

                startQueueTimer();
            }
            else if (response.status == 401) {
                mainpanel.port.emit('updatehead', 'Je gebruikersnaam en/of wachtwoord is onjuist.'); // 'Your username and/or password is incorrect.'
                logout();
            }
        }
    }).get();
}

function loadcontactsdata(base64auth){
    request({
        url: platform_url + 'api/' + phoneaccountsource + '/' + phoneaccountsource + '/',
        headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},

        onComplete: function(response) {
            if (response.status == 200) {
                mainpanel.port.emit('init-contact-list', response.json.objects);
            }
            else if (response.status == 401) {
                mainpanel.port.emit('updatehead', 'Je gebruikersnaam en/of wachtwoord is onjuist.'); 
                logout();
            }
        }

    }).get();
}

/* sets the selected userdestination to the provided type and id */
function selectuserdestination(type, id) {
    var callbackComplete = function(credentials) {
        var base64auth = 'Basic ' + btoa(credentials.username + ':' + credentials.password);
        var content = {
            fixeddestination: selected_fixed,
            phoneaccount: selected_phone
        };

        selected_fixed = null;
        selected_phone = null;
        if(type == 'fixed') {
            selected_fixed = id;
        }
        else if(type == 'phone') {
            selected_phone = id;
        }

        request({
            url: platform_url + 'api/' + selecteduserdestinationresource + '/' + selecteduserdestination_id + '/',
            headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
            content: JSON.stringify(content)
        }).put();

        startQueueTimer();

        if (id == null) {
            toolbarbutton.setIcon({url: data.url('assets/img/call-red.png')});
        }
        else {
            toolbarbutton.setIcon({url: data.url('assets/img/call-green.png')});
        }
    }

    getCredentials(callbackComplete, function(){});
}

/* updates the clicktodial panel with the call status */
function updatestatus() {
    request({
        url: platform_url + 'api/' + clicktodialresource + '/' + callid + '/',
        headers: {'Content-type': 'application/json', 'Accept': 'application/json'},

        onComplete: function (response) {
            if (response.status == 200) {
                var callstatus = response.json['status'];
                var showstatus = callstatus;

                switch(callstatus) {
                    case 'dialing_a':
                        showstatus = 'Je toestel wordt gebeld'; // 'Your phone is being called'
                        break;
                    case 'confirm':
                        showstatus = 'Toets een 1 om het gesprek aan te nemen'; // 'Press 1 to accept the call'
                        break;
                    case 'dialing_b':
                        showstatus = dialed_number + ' wordt gebeld'; // '() is being called'
                        break;
                    case 'connected':
                        showstatus = 'Verbonden'; // 'Connected'
                        break;
                    case 'disconnected':
                        showstatus = 'Verbinding verbroken'; // 'Connection lost'
                        break;
                    case 'failed_a':
                        showstatus = 'We konden je toestel niet bereiken'; // 'We could not reach your phone'
                        break;
                    case 'blacklisted':
                        showstatus = 'Het nummer staat op de blacklist'; // 'The number is on the blacklist'
                        break;
                    case 'failed_b':
                        showstatus = dialed_number + ' kon niet worden bereikt'; // '() could not be reached'
                        break;
                }

                clicktodialpanel.port.emit('updatestatus', showstatus);

                // breack line if status is disconected
                if(callstatus == 'disconnected'){
                    // clear interval but not close panel
                    // panel has status 'Verbinding verbroken'
                    timer.clearInterval(status_timer);
                }
            }
        }
    }).get();
}