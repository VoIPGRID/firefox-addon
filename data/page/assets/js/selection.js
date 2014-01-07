(function() {
    'use strict';

    self.on('click', function() {
        var selection = window.getSelection().toString();

        // in case of no selection according to window, try to get the
        // selection from an elements value
        if(selection === null || selection.length === 0) {
            var value = document.activeElement.value;
            if(value.length) {
                selection = value.substring(
                    document.activeElement.selectionStart,
                    document.activeElement.selectionEnd
                );
            }
        }

        if(selection) {
            self.postMessage(selection);
        }
    });

})();
