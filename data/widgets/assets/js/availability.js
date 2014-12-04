(function() {
    'use strict';

    function refresh() {
        // enable/disable dropdown depending on if the user is available or not
        var isAvailable = $('.availability-toggle [name="availability"]:checked').val() == 'yes';
        if(isAvailable) {
            $('.availability [name="selecteddestination"]').prop('disabled', false);
        } else {
            $('.availability [name="selecteddestination"]').prop('disabled', true);
        }
    }

    self.port.on('availability.refresh', function() {
        refresh();
    });

    self.port.on('availability.reset', function() {
        var list = $('[name="selecteddestination"]');
        list.empty();

        // poor workaround due to the lack of a viable solution to show a localized string here:
        // the text is copied from an attribute of the list element which is an already translated string
        var option = $('<option value="">').text($(list).attr('data-no-available-options-text'));
        option.appendTo(list);

        // which suggests you're not available (based on the available data: no possible destinations)
        $('.availability-toggle [name="availability"][value="no"]').prop('checked', true);

        refresh();
    });

    self.port.on('availability.fill', function(destinations) {
        var list = $('[name="selecteddestination"]');
        list.empty();

        var isAvailable = 'no';

        $.each(destinations, function(index, destination) {
            var option = $('<option>').val(destination.value).text(destination.label);
            if(destination.selected) {
                $(option).prop('selected', true);
                isAvailable = 'yes';
            }
            option.appendTo(list);
        });

        // update the radiobuttons depending on whether a selected option was provided or not
        $('.availability-toggle [name="availability"][value="' + isAvailable + '"]').prop('checked', true);

        // in turn, check whether to enable/disable the dropdown
        refresh();
    });

    $(function($) {
        /**
         * Change the user's availability.
         */
        $('.availability-toggle [name="availability"]').change(function() {
            // these values are used for val() == 'no' which clears the current destination
            var selectedType = null;
            var selectedId = null;

            if($(this).val() == 'yes') {
                // selects the first destination by default
                var selected_destination = $('[name="selecteddestination"]').val();
                var value = $('[name="selecteddestination"] option:selected').val().split('-');
                selectedType = value[0];
                selectedId = value[1];
            }
            self.port.emit('availability.toggle', selectedType, selectedId);
        });

        /**
         * Change the user's destination.
         */
        $('.availability [name="selecteddestination"]').change(function() {
            var value = $(this).find('option:selected').val().split('-');
            var selectedType = value[0];
            var selectedId = value[1];
            self.port.emit('availability.select', selectedType, selectedId);
        });
    });
})();
