(function() {
    "use strict";

    // sdk
    var data = require('sdk/self').data;
    var storage = require('sdk/simple-storage').storage;

    // 1st party
    var api = require('../api');
    var main = require('../main');

    var name = 'availability',
        port;

    exports.contentScripts = [
        data.url('widgets/assets/js/availability.js'),
    ];

    exports.init = function(_port) {
        port = _port;

        function selectUserdestination(type, id) {
            var content = {
                fixeddestination: null,
                phoneaccount: null,
            };
            if(type) {
                content[type] = id;
            }

            // save selection
            api.asyncRequest(
                api.getUrl('selecteduserdestination') + storage.user.selectedUserdestinationId + '/',
                content,
                'put',
                {
                    onOk: function() {
                        // set an icon depending on whether the user is available or not
                        var icon = 'widgets/assets/img/availability/call-red.png';
                        if(id) {
                            icon = 'widgets/assets/img/availability/call-green.png';
                        }
                        storage.widgets.availability.icon = icon;
                        if(!storage.widgets.queues.selected) {
                            main.setIcon(icon);
                        }
                    }
                }
            );
        }
        port.on('availability.select', function(type, id) {
            console.info('availability.select');
            selectUserdestination(type, id);
        });
        port.on('availability.toggle', function(type, id) {
            console.info('availability.toggle');

            selectUserdestination(type, id);
            port.emit('availability.refresh');
        });
    };

    exports.load = function() {
        api.asyncRequest(
            api.getUrl('userdestination'),
            null,
            'get',
            {
                onComplete: function() {
                    port.emit('widget.indicator.stop', name);
                },
                onOk: function(response) {
                    port.emit('availability.reset');

                    // there is only one userdestination so objects[0] is the right (and only) one
                    var userdestination = response.json.objects[0];
                    // save id for reference when changing the userdestination
                    if(storage.user) {
                        storage.user.selectedUserdestinationId = userdestination['selecteduserdestination']['id'];
                    }

                    // currently selected destination
                    var selectedFixeddestinationId = userdestination['selecteduserdestination']['fixeddestination'];
                    var selectedPhoneaccountId = userdestination['selecteduserdestination']['phoneaccount'];

                    // destinations choices
                    var fixeddestinations = userdestination['fixeddestinations'];
                    var phoneaccounts = userdestination['phoneaccounts'];

                    // build options for the availability dropdown from the choices above
                    var options = [];
                    fixeddestinations.forEach(function(fixeddestination) {
                        var option = {
                            'value': 'fixeddestination-' + fixeddestination.id,
                            'label': fixeddestination.phonenumber + '/' + fixeddestination.description,
                        };
                        if(fixeddestination.id == selectedFixeddestinationId) {
                            option['selected'] = true;
                        }
                        // add fixed destination to options
                        options.push(option);
                    });
                    phoneaccounts.forEach(function(phoneaccount) {
                        var option = {
                            'value': 'phoneaccount-' + phoneaccount.id,
                            'label': phoneaccount.internal_number + '/' + phoneaccount.description,
                        };
                        if(phoneaccount.id == selectedPhoneaccountId) {
                            option['selected'] = true;
                        }
                        // add phone account to options
                        options.push(option);
                    });

                    // fill the dropdown with these choices
                    port.emit('availability.fill', options);

                    // set an icon depending on whether the user is available or not
                    var icon = 'widgets/assets/img/availability/call-red.png';
                    if(selectedFixeddestinationId || selectedPhoneaccountId) {
                        icon = 'widgets/assets/img/availability/call-green.png';
                    }
                    storage.widgets.availability.icon = icon;
                    if(!storage.widgets.queues.selected) {
                        main.setIcon(icon);
                    }
                },
            }
        );
    };

    exports.reset = function() {
        port.emit('availability.reset');
        main.setIcon('assets/img/call-gray.png');
    };
})();
