
self.on("click", function() {
	var selection = window.getSelection().toString();

	if(selection == null || selection.length == 0) {
		var active = document.activeElement;

		selection = $(active).val()
			.substring(active.selectionStart, active.selectionEnd);
	}

	self.postMessage(selection);	
});