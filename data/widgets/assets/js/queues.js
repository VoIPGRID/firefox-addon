(function() {
    'use strict';

    window.cache['queue'] = {
        'list': [],
        'selected': null,
    };

    $(function($) {
        self.port.on('queue.reset', function() {
            var list = $('.queues .list');
            list.empty();
            $('.queues .empty-list').addClass('hide');
        });

        self.port.on('queue.empty', function() {
            $('.queues .empty-list').removeClass('hide');
        });

        // fill the queue list
        self.port.on('queue.fill', function(queues, selectedQueue) {
            $('.queues .empty-list').addClass('hide');

            if(cache.queue.list == queues && cache.queue.selected == selectedQueue) {
                // no changes so exit early
                console.info('no new queue data');
                return;
            }
            // update cache
            cache.queue.list = queues;
            cache.queue.selected = selectedQueue;

            // clear list
            var list = $('.queues .list');
            list.empty();

            // fill list
            var template = $('.queues .template .queue');
            $.each(queues, function(index, queue) {
                var listItem = template.clone();
                listItem.find('.indicator').text(queue.queue_size);
                listItem.find('.text').text(queue.description);
                listItem.find('.code').text('(' + queue.internal_number + ')');

                // check if this queue is currently selected
                if(selectedQueue && selectedQueue == queue.id) {
                    listItem.addClass('selected');
                }

                listItem.data('queue-id', queue.id);
                listItem.find('.indicator')
                    .attr('id', 'size' + queue.id);

                listItem.appendTo(list);
            });

            window.resize();
        });

        /**
         * Select a queue.
         */
        $('.queues .list').on('click', '.queue', function(event) {
            var queueId = null;
            if($(this).data('queue-id')) {
                // toggle selection
                $(this).toggleClass('selected');
                $(this).siblings().removeClass('selected');

                if($(this).hasClass('selected')) {
                    queueId = $(this).data('queue-id');
                }
            }

            cache.queue.selected = queueId;
            self.port.emit('queue.select', queueId);
        });

        // update the size for a queue
        self.port.on('queue.size', function(id, size) {
            if(isNaN(size)) {
                size = '?';  // queue size is not available
            }
            $('#size' + id).text(size);
        });
    });
})();
