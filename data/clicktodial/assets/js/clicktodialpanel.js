(function() {
    'use strict';

    function setText(element, text) {
        while(element.firstChild !== null) {
            element.removeChild(element.firstChild); // remove all existing content
        }
        element.appendChild(document.createTextNode(text));
    }

    self.port.on('clicktodial.b_number', function(number) {
        console.info('clicktodial.b_number');

        var numberElement = document.getElementById('number');
        setText(numberElement, number);
    });

    self.port.on('clicktodial.status', function(status) {
        console.info('clicktodial.status');

        if(status) {
            var statusElement = document.getElementById('status');
            setText(statusElement, status);
        }
    });

    var closeButton = document.getElementById('close');
    closeButton.onclick = function(event) {
        self.port.emit('clicktodialpanel.close');

        return false;
    };
})();
