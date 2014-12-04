(function() {
    'use strict';

    $(function() {
        // force size for .contact,
        // useful in case of a popout and the list of contacts
        // is larger in size (height) than the viewport.
        function resizeContacts() {
            var pluginWidth = $('.container').outerWidth();
            $('body.expand .contact').css('width', pluginWidth);
        }
        resizeContacts();
        $(window).resize(resizeContacts);

        self.port.on('widget.open', function(widgetName) {
            alert(widgetName);
            if(widgetName == 'contacts') {
                $('.contacts .list .contact:visible:last').addClass('last');
            }
        });

        // signal for information
        self.port.emit('panel.onshow');
    });
})();
