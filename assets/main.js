$(document).ready(function(){
	$('body').css('overflow','hidden');	
	if(1){
		var height = $(window).height();
		var width = $(window).width();
		$('.board').css('height',height);
	}
	var selector=0;
	var x, y;
	$('.input-item, .output-item').draggable({
		containment:'document', 
		revert:true,
		scope: "tasks",
		start:function(event, position){
			x=position.left;
			contents = $(this).text();
		},
		stop:function(){
			selector=scope;
		}
	});

	$('.board').droppable({
		hoverClass:'.board',		
		accept: '.input-item',
		drop:function(){
			$('.board').append('<span class="label label-primary">'+selector+'</span>');
		}		
	});

	$('board').droppable({
		hoverClass:'.board',	
		accept: '.output-item',
		drop:function(){
			$('.board').append('<span class="label label-warning">'+selector+'</span>');
		}
	});
	
	$('#create').on('click', function(){
		var $btn = $(this).button('loading');
		$('.board').append('<span class="label label-primary">'+selector+'</span>');
		$btn.button('reset')
	});
});
