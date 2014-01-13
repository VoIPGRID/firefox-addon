(function() {
    'use strict';

    // sdk
    var data = require('sdk/self').data;
    var storage = require('sdk/simple-storage').storage;
    var timers = require('sdk/timers');

    // 1st party
    var api = require('../api');
    var main = require('../main');
    var timer = require('../timer');

    var name = 'queues',
        port,
        queuecallgroups = [],
        sizes = {};

    exports.contentScripts = [
        data.url('widgets/assets/js/queues.js'),
    ];

    exports.init = function(_port) {
        port = _port;

        // keep track of selected queue
        port.on('queue.select', function(id) {
            storage.widgets.queues.selected = id;

            // restore the widget availability's icon or use an icon
            // representing the queue size
            var icon = storage.widgets.availability.icon;
            if(id) {
                var size = NaN;
                if(sizes && sizes.hasOwnProperty(id)) {
                    size = sizes[id];
                }
                icon = getIconForSize(size);
            }
            main.setToggleButtonProperties({
                icon: data.url(icon),
            });

            timer.update('queue.size');
        });
    };

    exports.load = function() {
        api.asyncRequest(
            api.getUrl('queuecallgroup'),
            null,
            'get',
            {
                onComplete: function() {
                    port.emit('widget.indicator.stop', name);
                },
                onOk: function(response) {
                    storage.widgets.queues.unauthorized = false;

                    // find the id's for queuecallgroups
                    var queues = response.json.objects;
                    if(queues.length){
                        queuecallgroups = [];

                        queues.forEach(function(queue) {
                            queuecallgroups.push(queue.id);
                        });

                        port.emit('queue.reset');
                        port.emit('queue.fill', queues, storage.widgets.queues.selected);

                        // reset storage
                        sizes = {};
                        queues.forEach(function(queue) {
                            sizes[queue.id] = queue.queue_size;
                        });
                    } else {
                        port.emit('queue.empty');
                    }

                    setQueueSizesTimer();
                },
                onUnauthorized: function() {
                    console.info('widget.unauthorized: ' + name);

                    // update authorization status
                    storage.widgets.queues.unauthorized = true;

                    // display an icon explaining the user lacks permissions to use
                    // this feature of the plugin
                    port.emit('widget.unauthorized', name);
                },
            }
        );
    };

    exports.reset = function() {
        timer.stopTimer('queue.size');
        timer.unregisterTimer('queue.size');
        port.emit('queue.reset');
        port.emit('queue.empty');
    };

    function getIconForSize(size) {
        var icon = 'widgets/assets/img/queue/queue.png';
        if(!isNaN(size)) {
            if(size < 10) {
                icon = 'widgets/assets/img/queue/queue' + size + '.png';
            } else {
                icon = 'widgets/assets/img/queue/queue10.png';
            }
        }
        return icon;
    }

    function setQueueSizesTimer() {
        function timerFunction() {
            if(queuecallgroups.length) {
                queuecallgroups.forEach(function(id) {
                    api.asyncRequest(
                        // FIXME: the current limitation on the server of 20r/m will always reject some requests (status 503) in case of more than one queuecallgroup
                        api.getUrl('queuecallgroup') + id + '/',
                        null,
                        'get',
                        {
                            onOk: function(response) {
                                var size = parseInt(response.json.queue_size, 10);
                                if(isNaN(size)) {
                                    size = '?';  // queue size is not available
                                }

                                // update icon for toolbarbutton if this queuecallgroup was selected earlier
                                if(response.json.id == storage.widgets.queues.selected) {
                                    main.setToggleButtonProperties({
                                        icon: data.url(getIconForSize(size)),
                                    });
                                }

                                sizes[response.json.id] = size;
                                port.emit('queue.size', response.json.id, size);
                            },
                            onUnauthorized: function() {
                                console.info('widget.unauthorized: ' + name);

                                // update authorization status
                                storage.widgets.queues.unauthorized = true;

                                // display an icon explaining the user lacks permissions to use
                                // this feature of the plugin
                                port.emit('widget.unauthorized', name);
                            },
                        }
                    );
                });
            }
        }

        // check for queue sizes on a variable timeout
        function timerTimeout() {
            var timeout = 0;

            // only when authenticated
            if(storage.user) {
                // at least every 20s when a queue is selected
                if(storage.widgets.queues.selected) {
                    timeout = 20000;
                }

                // quicker if the panel is visible and the queues widget is open
                if(storage.isMainPanelOpen) {
                    if(storage.widgets.isOpen[name]) {
                        timeout = 5000;
                    }
                }
            }

            console.info('timeout for queue.size: ' + timeout);
            return timeout;
        }

        timer.registerTimer('queue.size', timerFunction);
        timer.setTimeout('queue.size', timerTimeout, true);
        timer.startTimer('queue.size');
    }
})();
