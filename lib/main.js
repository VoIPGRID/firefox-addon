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
const passwords = require("passwords");
/* voipgrid apis */
const clicktodialresource = 'clicktodial';
const queueresource = 'queuecallgroup';
const selecteduserdestinationresource = 'selecteduserdestination';
const userdestinationresource = 'userdestination';

var callgroup_ids = new Array();
var callid = '';
var clicktodialpanel;
var client_id = '';
var dialed_number = '';
var mainpanel;
var platform_url = '';
var queue_timer = '';
var selected_fixed = null;
var selected_phone = null;
var selecteduserdestination_id = '';
var status_timer = '';
var toolbarbutton;
var user_id = '';

var host_name = 'chrome://voipgrid';
var form_submit_url = null;
var user_login_realm = 'User Login';

exports.main = function(options) {
    platform_url = prefs.prefs['platform_url'];
    dump('platform url: ' + platform_url + '\n');

    // if the api url is changed in the prefs, re-initialize the panel
    prefs.on('platform_url', function(prefname) {
        platform_url = prefs.prefs['platform_url'];
        dump('platform url: ' + platform_url + '\n');
        loadpaneldata();
    });

    // pagemod
    require('page-mod').PageMod({
        include: '*',
        contentScriptFile: [data.url('assets/js/jquery.js'), data.url('assets/js/clicktodialpagemod.js')],
        onAttach: function(worker) {
            worker.port.on('click', function(b_number) {
                clicktodial(b_number);
            });
        }
    });

    // create panel
    mainpanel = panel({
        width: 360,
        height: 200,
        contentScriptFile: [data.url('assets/js/jquery.js'), data.url('assets/js/panel.js')],
        contentURL: data.url('panel.html')
    });

    // resize the panel (for now only the height)
    mainpanel.port.on('resize', function(size) {
        // for osx add 2 pixels to prevent scrollbars
        if(require('runtime').os == 'darwin') {
            mainpanel.resize(mainpanel.width, size.height+2);
        }
        else {
            mainpanel.resize(mainpanel.width, size.height);
        }
    });
    // always resize the panel properly when shown
    mainpanel.on('show', function() {
        mainpanel.port.emit('resizeonshow');
    });
    // set username and password, put them in storage and setup the queue list
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
        timer.clearInterval(queue_timer);
        queue_timer = timer.setInterval(getqueuesizes, 5000);
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
    // add context menu item to dial selected number
    var menuitem = contextmenu.Item({
        label: 'Bel geselecteerde nummer', // 'Call selected number'
        context: contextmenu.SelectionContext(),
        contentScript: 'self.on("click", function() {self.postMessage(window.getSelection().toString());});',
        onMessage: function(number) {
            number = number.replace('(0)', '').replace(/[- \.\(\)]/g, '');
            clicktodial(number);
        }
    });
    // initially display the login form. the loadpaneldata() call below hides it again if all is well.
    mainpanel.port.emit('updateform', 'login');
    loadpaneldata();
};

function getCredentials(complete, error){
    var user = storage.username;

    dump('getCredentials method \n');

    if(user){
        passwords.search({
            username: user,
            url: platform_url,
            formSubmitURL: form_submit_url,
            realm: user_login_realm,

            onComplete: function onComplete(credentials) {
                for(var i in credentials){
                    if(credentials[i].username == user){
                        dump(' complete \n');
                        complete(credentials[i]);

                        return;
                    }
                }
                dump(' error \n');
                error();
            },
            
            onError: function onError(ex){
                dump(' error \n');
                error();
            }
        });
    }else{
        dump(' error \n');
        error();
    }
}

function login(username, password){
    
    dump('login method \n');

    storage.username = username;

    passwords.store({
        url: platform_url,
        formSubmitURL: form_submit_url,
        realm: user_login_realm,
        username: username,
        password: password,

        onComplete: function onComplete(){
            dump(' complete \n');
            loadpaneldata();
        },

        onError: function onError(error){
            dump(' error: ' + error.message + '\n');
            logout();
        }
    });

}

function logout() {
    dump('logout method \n');

    var user = storage.username;

    if(user){
        passwords.search({
            username: user,
            url: platform_url,
            formSubmitURL: form_submit_url,
            realm: user_login_realm,
            
            onComplete: function onComplete(credentials) {
                credentials.forEach(passwords.remove);

                storage.username = '';
                displayloginform();
            },

            onError: function onError(error){
                dump(error.message + '\n');

                storage.username = '';
                displayloginform();
            }
        });
    }else{

        storage.username = '';
        displayloginform();
    }
}

/* handles clicktodial: initiates a call and shows the clicktodial panel. */
function clicktodial(b_number) {
    dialed_number = b_number;

    var callbackComplete = function(credentials){

        var base64auth = 'Basic ' + btoa(credentials.username + ':' + credentials.password);
        var content = JSON.stringify({ b_number: b_number.replace(/[^0-9+]/g, '') });
        
        dump('clicktodial request start \n');

        request({
            url: platform_url + 'api/' + clicktodialresource + '/',
            content: content,
            headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
            onComplete: function (response) {
                dump('clicktodial request complete \n');

                if (response.json != null && response.json['callid'] != null) {
                    dump('clicktodial callid: ' + response.json['callid'] + ' \n');

                    // display the clicktodialpanel only if we have a callid
                    callid = response.json['callid'];
                    status_timer = timer.setInterval(updatestatus, 500);
                    clicktodialpanel = panel({
                        width: 302,
                        height: 85,
                        contentScriptFile: [data.url('assets/js/jquery.js'), data.url('assets/js/clicktodialpanel.js')],
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

    dump('clicktodial method \n');
    getCredentials(callbackComplete, callbackError);
}

/* when no valid username or password is entered: displays a login form and resets values and the icon */
function displayloginform() {
    dump('displayloginform method \n');

    client_id = '';
    user_id = '';
    selecteduserdestination_id = '';
    mainpanel.port.emit('updateform', 'login');
    mainpanel.port.emit('updatelist', {type: 'clear'});
    mainpanel.port.emit('resizeonshow');
    timer.clearInterval(queue_timer);
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

    dump('getqueuesizes method \n');
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

    dump('loadpaneldata method \n');
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

                mainpanel.port.emit('updatelist', 
                    {type: 'queues', queues: queues, primary: storage.primary});

                if(queues.length != 0){
                    callgroup_ids = new Array();

                    for (var i in queues) {
                        callgroup_ids.push(queues[i]['id']);
                    }
                }

                getqueuesizes();
                queue_timer = timer.setInterval(getqueuesizes, 5000);
            }
            else if (response.status == 401) {
                mainpanel.port.emit('updatehead', 'Je gebruikersnaam en/of wachtwoord is onjuist.'); // 'Your username and/or password is incorrect.'
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
        timer.clearInterval(queue_timer);
        queue_timer = timer.setInterval(getqueuesizes, 5000);
        if (id == null) {
            toolbarbutton.setIcon({url: data.url('assets/img/call-red.png')});
        }
        else {
            toolbarbutton.setIcon({url: data.url('assets/img/call-green.png')});
        }
    }

    dump('selectuserdestination method \n');
    getCredentials(callbackComplete, function(){});
}

/* updates the clicktodial panel with the call status */
function updatestatus() {
    dump('updatestatus method \n');
    dump('updatestatus callid: ' + callid + ' \n');

    request({
        url: platform_url + 'api/' + clicktodialresource + '/' + callid + '/',
        headers: {'Content-type': 'application/json', 'Accept': 'application/json'},
        onComplete: function (response) {
            dump('updatestatus request complete \n');
            dump('updatestatus response status: ' + response.status + '\n');

            if (response.status == 200) {
                dump('updatestatus callstatus: ' + response.json['status'] + '\n');

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
            }
        }
    }).get();
}
