/*
 * jQuery UI Sortable @VERSION
 *
 * Copyright 2010, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Sortables
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.mouse.js
 *	jquery.ui.widget.js
 */
 
(function($) {
  
  $.widget("ui.multidnd", $.ui.mouse, {

  	options: {
  		appendTo: 'body',
  		autoRefresh: true,
  		distance: 0,
  		helper: "original",
  		filter: '*',
  		tolerance: 'touch'
  	},
  	_create: function() {
  		var self = this;

  		this.element.addClass("ui-selectable");

  		this.dragged = false;

  		// cache selectee children based on filter
  		var selectees;
  		this.refresh = function() {
  			selectees = $(self.options.filter, self.element[0]);
  			selectees.each(function() {
  				var $this = $(this);
  				var pos = $this.offset();
  				$.data(this, "selectable-item", {
  					element: this,
  					$element: $this,
  					left: pos.left,
  					top: pos.top,
  					right: pos.left + $this.outerWidth(),
  					bottom: pos.top + $this.outerHeight(),
  					startselected: false,
  					selected: $this.hasClass('ui-selected'),
  					selecting: $this.hasClass('ui-selecting'),
  					unselecting: $this.hasClass('ui-unselecting')
  				});
  			});
  		};
  		this.refresh();

  		this.selectees = selectees.addClass("ui-selectee");

  		this._mouseInit();

      // this.helper = $("<div class='ui-selectable-helper'></div>");
  	},

  	destroy: function() {
  		this.selectees
  			.removeClass("ui-selectee")
  			.removeData("selectable-item");
  		this.element
  			.removeClass("ui-selectable ui-selectable-disabled")
  			.removeData("selectable")
  			.unbind(".selectable");
  		this._mouseDestroy();

  		return this;
  	},

  	_mouseStart: function(event) {
  		var self = this;

  		this.opos = [event.pageX, event.pageY];

  		if (this.options.disabled)
  			return;

  		var options = this.options;

  		this.selectees = $(options.filter, this.element[0]);

  		this._trigger("start", event);
  
  		if (options.autoRefresh) {
  			this.refresh();
  		}
      
      // mouse down on a non-selected item
      if (!$(event.target).hasClass('ui-selected') && !event.metaKey) {
        // move all items that were previously selected to a state of unselecting
        this.selectees.filter('.ui-selected').each(function() {
          var selectee = $.data(this, "selectable-item");
          selectee.$element.removeClass('ui-selected');
          selectee.selected = false;
          selectee.$element.addClass('ui-unselecting');
          selectee.unselecting = true;
          self._trigger("unselecting", event, {
  					unselecting: selectee.element
  				});
        });
        
        // move the item that was mouse downed on to a state of selecting
        var selectee = $(event.target).data("selectable-item");
        selectee.$element.addClass('ui-selecting');
        selectee.selecting = true;
        
      // meta mouse down on a non-selected item
      } else if (!$(event.target).hasClass('ui-selected') && event.metaKey) {
        // move the item that was meta mouse downed to a state of selecting
        var selectee = $(event.target).data("selectable-item");
        selectee.$element.addClass('ui-selecting');
        selectee.selecting = true;
        
      // meta mouse down on an already selected item 
      } else if ($(event.target).hasClass('ui-selected') && event.metaKey) {
        // move the item that was meta mouse downed to a state of unselecting
        var selectee = $(event.target).data("selectable-item");
        selectee.$element.removeClass('ui-selected');
        selectee.selected = false;
        selectee.$element.addClass('ui-unselecting');
        selectee.unselecting = true;
        self._trigger("unselecting", event, {
					unselecting: selectee.element
				});
			
		  // mouse down on an already selected item  
      } else if ($(event.target).hasClass('ui-selected') && !event.metaKey) {
        // do nothing in this case
      }  		
  	},

  	_mouseDrag: function(event) {
  		var self = this;
  		this.dragged = true;
  		
  		console.log("Mouse Drag just happened");

  		return false;
  	},

  	_mouseStop: function(event) {
  		var self = this;

  		this.dragged = false;

  		var options = this.options;


      // non-meta key mouse up on an element that is selected
      if ($(event.target).hasClass('ui-selected') && !event.metaKey) {
        // everything that is already selected should be put in state of unselecting
        
        // everything that was already selected should be put in state of unselected
        this.selectees.filter('.ui-selected').not($(event.target)).each(function() {
          var selectee = $.data(this, "selectable-item");
          selectee.$element.removeClass('ui-selected');
          selectee.selected = false;
          selectee.$element.addClass('ui-unselected');
          selectee.unselected = true;
          self._trigger("unselected", event, {
  					unselected: selectee.element
  				});
        });
      } else {
    		$('.ui-unselecting', this.element[0]).each(function() {
    			var selectee = $.data(this, "selectable-item");
    			selectee.$element.removeClass('ui-unselecting');
    			selectee.unselecting = false;
    			selectee.startselected = false;
    			self._trigger("unselected", event, {
    				unselected: selectee.element
    			});
    		});
    		$('.ui-selecting', this.element[0]).each(function() {
    			var selectee = $.data(this, "selectable-item");
    			if( $(event.target)[0] == selectee.$element[0] ) {
    			  selectee.$element.removeClass('ui-selecting').addClass('ui-selected');
    			  selectee.selecting = false;
    			  selectee.selected = true;
    			  selectee.startselected = true;
    			  self._trigger("selected", event, {
    				  selected: selectee.element
    			  });
  			  }
  			  else {
  			    selectee.$element.removeClass('ui-selecting');
  			    selectee.selecting = false;
  			  }
    		});        
      }

  		this._trigger("stop", event);

      // this.helper.remove();

  		return false;
  	}

  });
    
})(jQuery);
