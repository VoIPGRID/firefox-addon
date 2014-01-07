/**
 * This timer keeps track of all used timers inside this plugin and can
 * clear, start or change the timeout of these timers at any time.
 */
(function() {
     'use strict';

    // sdk
    var timers = require('timers');

    // 1st party

    var registeredTimers = {};

    function getRegisteredTimer(timerId) {
        if(registeredTimers.hasOwnProperty(timerId)) {
            return registeredTimers[timerId];
        }

        console.warn('no such timer: ' + timerId);
        return null;
    }

    exports.init = function() {
        console.info('init');
    };

    exports.update = function(timerId) {
        if(timerId) {
            startTimer(timerId);
        } else {
            for(timerId in registeredTimers) {
                startTimer(timerId);
            }
        }
    };

    exports.registerTimer = function(timerId, timerFunction) {
        registeredTimers[timerId] = {
            function: timerFunction,
            interval: null,  // interval in miliseconds
            timeout: null,  // timeout in miliseconds
            reset: false,
            timer : {  // references to timer objects to be able to clear it later
                interval: null,
                timeout: null,
            }
        };
    };

    exports.unregisterTimer = function(timerId) {
        if(getRegisteredTimer(timerId)) {
            delete registeredTimers[timerId];
        }
    };

    exports.setInterval = function(timerId, interval) {
        if(getRegisteredTimer(timerId)) {
            registeredTimers[timerId]['interval'] = interval;
        }
    };

    exports.setTimeout = function(timerId, timeout, reset) {
        if(getRegisteredTimer(timerId)) {
            registeredTimers[timerId]['timeout'] = timeout;

            // *reset* indicates whether to re-run *timerFunction* after
            // *timeout* miliseconds it finished
            registeredTimers[timerId]['reset'] = reset;
        }
    };

    function startTimer(timerId) {
         if(getRegisteredTimer(timerId)) {
            var timerFunction = registeredTimers[timerId]['function'];
            if(registeredTimers[timerId]['interval']) {
                registeredTimers[timerId]['timer']['interval'] = timers.setInterval(timerFunction, registeredTimers[timerId]['interval']);
            }

            var timeout = registeredTimers[timerId]['timeout'];
            if(typeof timeout === 'function') {
                timeout = timeout();
            }
            if(timeout) {
                if(registeredTimers[timerId]['reset']) {
                    var resetFunction = function() {
                        timerFunction();

                        // call again once finished
                        var timeout = registeredTimers[timerId]['timeout'];
                        if(typeof timeout === 'function') {
                            timeout = timeout();
                        }
                        if(timeout) {
                            stopTimer(timerId);
                            registeredTimers[timerId]['timer']['timeout'] = timers.setTimeout(resetFunction, timeout);
                        }
                    };
                    stopTimer(timerId);
                    registeredTimers[timerId]['timer']['timeout'] = timers.setTimeout(resetFunction, timeout);
                } else {
                    stopTimer(timerId);
                    registeredTimers[timerId]['timer']['timeout'] = timers.setTimeout(timerFunction, timeout);
                }
            }
        }
    }
    exports.startTimer = function(timerId) {
        startTimer(timerId);
    };

    function stopTimer(timerId) {
        if(getRegisteredTimer(timerId)) {
            if(registeredTimers[timerId]['timer']['interval']) {
                timers.clearInterval(registeredTimers[timerId]['timer']['interval']);
                registeredTimers[timerId]['timer']['interval'] = null;
            }
            if(registeredTimers[timerId]['timer']['timeout']) {
                timers.clearTimeout(registeredTimers[timerId]['timer']['timeout']);
                registeredTimers[timerId]['timer']['timeout'] = null;
            }
        }
    }
    exports.stopTimer = function(timerId) {
        stopTimer(timerId);
    };
})();
