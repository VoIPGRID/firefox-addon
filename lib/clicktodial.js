(function() {
    'use strict';

    // sdk
    var data = require('sdk/self').data;
    var notify = require('sdk/notifications').notify;

    // 1st party
    var api = require('./api');
    var panels = require('./panels');
    var timer = require('./timer');
    var translate = require('./translate').translate;

    /**
     * Setup the call between the number from the user's clicktodialaccount and b_number.
     */
    exports.dial = function(b_number) {
        console.info('Calling ' + b_number);
        var content = {
            b_number: '' + b_number.replace(/[^0-9+]/g, ''),  // just make sure b_number is numbers only
        };

        api.asyncRequest(
            api.getUrl('clicktodial'),
            content,
            'post',
            {
                onOk: function(response) {
                    // this callid is used to find the call status, so without it: stop now
                    if(!response.json.callid) {
                        notify({
                            text: translate('callFailedNotificationText'),
                            // iconURL: data.url('clicktodial/assets/img/clicktodial.png')
                        });
                        return;
                    }

                    // the status retrieved by callid is shown in a small panel, show it now
                    var clicktodialpanel = new panels.ClickToDialPanel();

                    // copy the number to the panel
                    clicktodialpanel.port.emit('clicktodial.b_number', b_number);

                    // copy the initial status
                    clicktodialpanel.port.emit('clicktodial.status', getStatusMessage(response.json.status, b_number));

                    // keep updating the call status to the panel
                    var timerFunction = function() {
                        api.asyncRequest(
                            api.getUrl('clicktodial') + response.json.callid + '/',
                            null,
                            'get',
                            {
                                onOk: function(response) {
                                    console.info('clicktodial status: ' + response.json.status);

                                    // stop after receiving these statuses
                                    var statuses = ['blacklisted', 'disconnected', 'failed_a', 'failed_b'];
                                    if(statuses.indexOf(response.json.status) != -1) {
                                        timer.stopTimer('clicktodial.status');
                                        timer.unregisterTimer('clicktodial.status');
                                    }

                                    // update panel with latest status
                                    clicktodialpanel.port.emit('clicktodial.status', getStatusMessage(response.json.status, b_number));
                                },
                                onNotOk: function() {
                                    // clear interval, stop timer
                                    timer.stopTimer('clicktodial.status');
                                    timer.unregisterTimer('clicktodial.status');
                                },
                            }
                        );
                    };

                    timer.registerTimer('clicktodial.status', timerFunction);
                    timer.setInterval('clicktodial.status', 1500);

                    clicktodialpanel.show();
                },
                onNotOk: function(response) {
                    notify({
                        text: translate('callFailedNotificationText'),
                        // iconURL: data.url('clicktodial/assets/img/clicktodial.png')
                    });
                },
            }
        );
    };

    function getStatusMessage(status, b_number) {
        var messages = {
            'dialing_a': translate('clicktodialStatusDialingA'),
            'confirm': translate('clicktodialStatusConfirm'),
            'dialing_b': translate('clicktodialStatusDialingB', b_number),
            'connected': translate('clicktodialStatusConnected'),
            'disconnected': translate('clicktodialStatusDisconnected'),
            'failed_a': translate('clicktodialStatusFailedA'),
            'blacklisted': translate('clicktodialStatusBlacklisted'),
            'failed_b': translate('clicktodialStatusFailedB', b_number),
        };

        var message = translate('clicktodialCallingText');
        if(messages.hasOwnProperty(status)) {
            message = messages[status];
        }

        return message;
    }
})();
