
$(function(){
	self.postMessage($(window).height());

	$(window).resize(function(){
		self.postMessage($(window).height());
	})
})