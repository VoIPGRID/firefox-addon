self.port.on('updatenumber', function(number) {
    $('#number').text(number);
});

self.port.on('updatestatus', function(status) {
    $('#status').text(status);
});

// handle button clicks
window.addEventListener('click', function(event) {
    if(event.target.id == 'close') {
        self.port.emit('close');
    }
}, false);
