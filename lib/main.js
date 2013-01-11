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
var loginform = "<fieldset><table><tr><td>e-mailadres</td><td><input type='text' id='username'/></td></tr>" +
        "<tr><td>wachtwoord</td><td><input type='password' id='password'/></td></tr></table></fieldset><br/>" +
        "<ul class='menu'><li data-link='login'><i class='icon-signin' id='login'></i>Inloggen</li></ul>";
var mainpanel;
var platform_url = '';
var queue_timer = '';
var selected_fixed = null;
var selected_phone = null;
var selecteduserdestination_id = '';
var status_timer = '';
var toolbarbutton;
var user_id = '';

exports.main = function(options) {
    platform_url = prefs.prefs['platform_url'];
    // if the api url is changed in the prefs, re-initialize the panel
    prefs.on('platform_url', function(prefname) {
        platform_url = prefs.prefs['platform_url'];
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
        storage.username = user;
        storage.password = pass;
        loadpaneldata();
    });
    // clear username and password and show the login form
    mainpanel.port.on('logout', function() {
        mainpanel.port.emit('updatehead', 'Uitgelogd');
        displayloginform();
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
        label: 'Bel geselecteerde nummer',
        context: contextmenu.SelectionContext(),
        contentScript: 'self.on("click", function() {self.postMessage(window.getSelection().toString());});',
        onMessage: function(number) {
            number = number.replace('(0)', '').replace(/[- \.\(\)]/g, '');
            clicktodial(number);
        }
    });
    // initially display the login form. the loadpaneldata() call below hides it again if all is well.
    mainpanel.port.emit('updateform', loginform);
    loadpaneldata();
};

/* handles clicktodial: initiates a call and shows the clicktodial panel. */
function clicktodial(b_number) {
    dialed_number = b_number;
    var username = storage.username;
    var password = storage.password;
    if (username && password) {
        var base64auth = 'Basic ' + btoa(username + ':' + password);
        var content = '{\"b_number\": \"' + b_number.replace(/[^0-9+]/g, '') + '\"}';
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
                        text: 'Het is niet gelukt om het gesprek op te zetten.',
                        iconURL: data.url('clicktodial.gif')
                    });
                }
            }
        }).post();
    }
    else {
        require('notifications').notify({
            text: 'Om gebruik te kunnen maken van Klik en Bel moet eerst ingelogd worden, door op het icoontje op de ' +
                    'toolbar te klikken en je gegevens in te vullen.',
            iconURL: data.url('clicktodial.gif')
        });
    }
}

/* when no valid username or password is entered: displays a login form and resets values and the icon */
function displayloginform() {
    storage.username = '';
    storage.password = '';
    client_id = '';
    user_id = '';
    selecteduserdestination_id = '';
    mainpanel.port.emit('updateform', loginform);
    mainpanel.port.emit('updatelist', '');
    mainpanel.port.emit('resizeonshow');
    timer.clearInterval(queue_timer);
    toolbarbutton.setIcon({url: data.url('assets/img/call-gray.png')});
}

/* fills the queue list with queue sizes */
function getqueuesizes() {
    var username = storage.username;
    var password = storage.password;
    if (username && password) {
        var base64auth = 'Basic ' + btoa(username + ':' + password);
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
                            queue_size = '?';//'niet beschikbaar';
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
    else {
        toolbarbutton.setIcon({url: data.url('assets/img/call-gray.png')});
    }
}

/* constructs select input of userdestinations and sets up queue list with a list of callgroups */
function loadpaneldata() {
    var username = storage.username;
    var password = storage.password;
    if (username && password) {
        var base64auth = 'Basic ' + btoa(username + ':' + password);
        // fetch userdestination info
        request({
            url: platform_url + 'api/' + userdestinationresource + '/',
            headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
            onComplete: function(response) {
                if (response.status == 200) {
                    var html = '';
                    var userdestinations = eval(response.json['objects'][0]);
                    if (userdestinations == null || userdestinations.length == 0) {
                        mainpanel.port.emit('updatehead', 'Je gebruikersnaam en/of wachtwoord is onjuist.');
                        displayloginform();
                    }
                    else {
                        // construct select input of userdestinations
                        client_id = userdestinations['client'];
                        user_id = userdestinations['user'];
                        selecteduserdestination_id = userdestinations['selecteduserdestination']['id'];
                        selected_fixed = userdestinations['selecteduserdestination']['fixeddestination'];
                        selected_phone = userdestinations['selecteduserdestination']['phoneaccount'];
                        if(selected_fixed == null && selected_phone == null) {
                            // set 'no' as selected radio input and disable statusupdate select input
                            mainpanel.port.emit('noselecteduserdestination');
                        }
                        if (userdestinations['fixeddestinations'].length == 0 && userdestinations['phoneaccounts'].length == 0) {
                            html = '<option>Je hebt momenteel geen bestemmingen.</option>';
                            mainpanel.port.emit('nouserdestinations');
                        }
                        else {
                            for (var i in userdestinations['fixeddestinations']) {
                                f = userdestinations['fixeddestinations'][i];
                                var selected = '';
                                if (f['id'] == selected_fixed) {
                                    selected = ' selected="selected"';
                                }
                                html += '<option id="fixed-' + f['id'] + '" value="fixed-' + f['id'] + '"' + selected + 
                                        '>+' + f['phonenumber'] + '/' + f['description'] +  '</option>';
                            }
                            for (var i in userdestinations['phoneaccounts']) {
                                p = userdestinations['phoneaccounts'][i];
                                var selected = '';
                                if (p['id'] == selected_phone) {
                                    selected = ' selected="selected"';
                                }
                                html += '<option id="phone-' + p['id'] + '" value="phone-' + p['id'] + '"' + selected + 
                                        '>' + p['internal_number'] + '/' + p['description'] +  '</option>';
                            }
                            // make sure the radio inputs are enabled
                            mainpanel.port.emit('enableuserdestinations');
                        }
                        if (selected_fixed == null && selected_phone == null) {
                            toolbarbutton.setIcon({url: data.url('assets/img/call-red.png')});
                        }
                        else {
                            toolbarbutton.setIcon({url: data.url('assets/img/call-green.png')});
                        }
                        mainpanel.port.emit('updateform', '');
                        mainpanel.port.emit('updatehead', username);
                        mainpanel.port.emit('updatestatus', html);
                        // the user destinations have been loaded succesfully. we may fetch the queue list now.
                        loadqueuedata(base64auth);
                    }
                }
                else if (response.status == 401) {
                    mainpanel.port.emit('updatehead', 'Je gebruikersnaam en/of wachtwoord is onjuist.');
                    displayloginform();
                }
            }
        }).get();
    }
}

/* fetches queue info and loads them into the list on the main panel */
function loadqueuedata(base64auth) {
    request({
        url: platform_url + 'api/' + queueresource + '/',
        headers: {'Content-type': 'application/json', 'Accept': 'application/json', 'Authorization': base64auth},
        onComplete: function(response) {
            if (response.status == 200) {
                var html = '';
                var queues = eval(response.json['objects']);
                // no queues, no list
                if (queues.length == 0) {
                    html = '<ul><li>Je hebt momenteel geen wachtrijen.</li></ul>';
                }
                // build html list for queue info
                else {
                    callgroup_ids = new Array();
                    html = '<ul>'
                    for (var i in queues) {
                        q = queues[i];
                        var selected = '';
                        if (q['id'] == storage.primary) {
                            selected = ' class="selected"';
                        }
                        html += '<li title="' + q['id'] + '"' + selected + '><span class="indicator" id="size' + 
                                q['id'] + '" title="' + q['id'] + '">?</span> ' + q['description'] + 
                                ' <span class="code">(' + q['internal_number'] + ')</span></li>';
                        callgroup_ids.push(q['id']);
                    }
                    html += '<ul>'
                }
                mainpanel.port.emit('updatelist', html);
                getqueuesizes();
                queue_timer = timer.setInterval(getqueuesizes, 5000);
            }
            else if (response.status == 401) {
                mainpanel.port.emit('updatehead', 'Je gebruikersnaam en/of wachtwoord is onjuist.');
                displayloginform();
            }
        }
    }).get();
}

/* sets the selected userdestination to the provided type and id */
function selectuserdestination(type, id) {
    var username = storage.username;
    var password = storage.password;
    if (username && password) {
        var base64auth = 'Basic ' + btoa(username + ':' + password);
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
            content: '{\"fixeddestination\": ' + selected_fixed + ', \"phoneaccount\": ' + selected_phone + '}'
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
                        showstatus = 'Je toestel wordt gebeld';
                        break;
                    case 'confirm':
                        showstatus = 'Toets een 1 om het gesprek aan te nemen';
                        break;
                    case 'dialing_b':
                        showstatus = dialed_number + ' wordt gebeld';
                        break;
                    case 'connected':
                        showstatus = 'Verbonden';
                        break;
                    case 'disconnected':
                        showstatus = 'Verbinding verbroken';
                        break;
                    case 'failed_a':
                        showstatus = 'We konden je toestel niet bereiken';
                        break;
                    case 'blacklisted':
                        showstatus = 'Het nummer staat op de blacklist';
                        break;
                    case 'failed_b':
                        showstatus = dialed_number + ' kon niet worden bereikt';
                        break;
                }
                clicktodialpanel.port.emit('updatestatus', showstatus);
            }
        }
    }).get();
}
