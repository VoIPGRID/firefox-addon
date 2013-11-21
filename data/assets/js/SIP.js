/**
 * SIP Module
 *
 * Implements the SIPml5 library.
 *
 * @type {*}
 */
var SIP = function () {
    // Private

    // Declare variables
    var sipStack;
    var registerSession;
    var callSession;

    var init = function () {
            dump('Init SIP module' +'\n');

            var sipStackEventListener = function (e) {
                dump('SipStack: ' + e.type + '\n');

                if (e.type == 'started') { // sip stack started
                    dump('Stack started' + '\n');
                    self.port.emit('sip_stack_started');
                    login();
                }
                else if (e.type == 'i_new_call') { // incoming call
                    e.o_session.stop();
                }
            }

            if(SIPml.isInitialized()){
                createSipStack({ eventListener: sipStackEventListener });
            }else{
                dump('SIPml library not initialized' + '\n');
                throw new Exception('SIPml library not initialized');
            }

            self.port.on('sip_start', function(){
                stop();
                start();
            });

            self.port.on('sip_stop', function(){
                stop();
            });

            return this;
        },
        start = function () {
            dump('Start SIP' + '\n');
            sipStack.start();
            // mediator.publish('sip_started');
        },
        stop = function () {
            dump('Stop SIP' + '\n');
            sipStack.stop();
            // mediator.publish('sip_stopped');
        },
        createSipStack = function (args) {
            sipStack = new SIPml.Stack({
                    realm: sipConfig['sip_realm'], // mandatory: domain name
                    impi: sipConfig['sip_impi'], // mandatory: authorization name (IMS Private Identity)
                    impu: sipConfig['sip_impu'], // mandatory: valid SIP Uri (IMS Public Identity)
                    password: sipConfig['sip_pass'], // optional
                    display_name: sipConfig['sip_display_name'], // optional
                    websocket_proxy_url: 'ws://websocket.voipgrid.osso.nl:80', // optional
                    enable_rtcweb_breaker: false, // optional
                    sip_headers: [ // optional
                        { name: 'User-Agent', value: 'IM/Webclient SIPml5'},//.IM-client/OMA1.0 sipML5-v1.0.0.0' },
                        { name: 'Organization', value: 'Voys Telecom' }
                    ],
                    events_listener: { events: '*', listener: args.eventListener } // optional: '*' means all events
                }
            );
        },
        login = function () {
            var loginListener = function (e) {
                if (e.type == 'connected' && e.session == registerSession) {
                    dump("Info SIP Stack Connected" + '\n');
                    // mediator.publish('sip_stack_connected');
                }
            }
            dump("Info SIP Stack Registration" + '\n');
            registerSession = sipStack.newSession('register', {
                events_listener: { events: '*', listener: loginListener } // optional: '*' means all events
            });
            registerSession.register();
        },
        makeCall = function (args) {
            callSession = sipStack.newSession(args.callType, {
                video_local: args.localVideo,
                video_remote: args.remoteVideo,
                audio_remote: args.remoteAudio,
                events_listener: { events: '*', listener: function (e) {
                    dump('Call session: ' + e.type + '\n');
                }
                }
            });
            callSession.call(args.to);
        },
        acceptCall = function (e) {
            e.newSession.accept(); // e.newSession.reject() to reject the call
        },
        subscribeTo = function (args) {
           // Setup listener
            var listener = function (e) {
                if (e.type == 'i_notify') {
                    dump('NOTIFY:\n ' + e.getContentString() + '\n');
                    if (e.getContentType() == 'application/dialog-info+xml') {
                        var xml = e.getContentString(),
                            xmlDoc = $.parseXML( xml ),
                            $xml = $( xmlDoc ),
                            dialogInfo = $xml.find('dialog-info'),
                            stateAttr = $xml.find('dialog-info').attr('state'),
                            dialog = $xml.find('dialog'),
                            stateValue = $xml.find('dialog state').text();

                        if (dialogInfo !== null) {
                            var state = '',
                                call = null;
                            if(stateAttr=='partial'){
                                var settingUp = typeof dialog.attr('local-tag') !== 'undefined' || stateValue == 'trying';
                                if(settingUp)
                                    state = 'ringing';
                                else
                                    state = 'busy';

                                call = new Call();
                                call.fromDialog(xml);
                            }
                            else if(stateAttr=='full'){
                                state = 'available';
                            }
                            else {
                                state = 'unavailable';
                            }

                            // Call the notify callback given with args
                            args.notify(
                                {
                                    state: state,
                                    call: call,
                                    xml: e.getContentString()
                                }
                            );
                        }
                        else {
                            dump('Error: NOTIFY has no "dialog-info"' + '\n');
                            throw 'Error: NOTIFY has no "dialog-info"';
                        }
                    }
                }
                else if (e.type == 'i_ao_request') {
                    var code = e.o_event.i_code;
                    var description = e.description;
                    // Call the error callback given with args
                    if(code >= 400 && code < 600)
                        args.error(
                            {
                                code: code,
                                description: description
                            }
                        );
                }
            }
            // Setup subscribe session
            var subscribeSession = sipStack.newSession('subscribe', {
                expires: 200,
                events_listener: { events: '*', listener: listener },
                sip_headers: [
                    { name: 'Event', value: 'dialog' }, // only notify for 'dialog' events
                    { name: 'Accept', value: 'application/dialog-info+xml' } // subscribe to dialog-info
                ],
                sip_caps: [
                    { name: '+g.oma.sip-im', value: null },
                    { name: '+audio', value: null },
                    { name: 'language', value: '\"en\"' }
                ]
            });
            // start watching for entity's presence status (You may track event type 'connected' to be sure that the request has been accepted by the server)
            subscribeSession.subscribe(args.impu);
        }

    // Public
    return {
        init: init,
        start: start,
        stop: stop,
        login: login,
        makeCall: makeCall,
        subscribeTo: subscribeTo
    };
};