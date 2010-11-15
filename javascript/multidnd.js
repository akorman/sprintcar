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
 *  jquery.ui.core.js
 *  jquery.ui.mouse.js
 *  jquery.ui.widget.js
 */
(function($) {
  $.widget("ui.multidnd", $.ui.mouse, {
    options: {
      appendTo: 'body',
      autoRefresh: true,
      threshold: 10,
      distance: 0, // NOTE WE HAVE TO HAVE THIS TO HANDLE THRESHOLD DON'T CHANGE
      helper: "original",
      filter: '*',
      tolerance: 'touch',
      scope: 'default',
      refreshPositions: false,
      tolerance: 'intersect'
    },
    _create: function() {
      var self = this;
      
      this.element.addClass("ui-selectable");
      var insertPlaceHolder = $('<li class="insert-placeholder"/>');
      this.element.data("insertionPlaceHolder", insertPlaceHolder);
      
      this.dragged = false;
      this.possible_nonselected_drag = false;
      
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
    
    _foobartitty: function(event) {
      return (Math.max(
          Math.abs(this.opos[0] - event.pageX),
          Math.abs(this.opos[1] - event.pageY)
        ) >= this.options.threshold
      );
    },
    
  	_cacheHelperProportions: function() {
  		this.helperProportions = {
  			width: this.helper.outerWidth(),
  			height: this.helper.outerHeight()
  		};
  	},
  	    
    _mouseStart: function(event) {
      var self = this;
      
      this.opos = [event.pageX, event.pageY];
      this.positionAbs = { top: event.pageY, left: event.pageX };
      
      if (this.options.disabled)
        return;
      
      var options = this.options;
      
      this.selectees = $(options.filter, this.element[0]);
      
      this._trigger("start", event);
      
      if (options.autoRefresh) {
        this.refresh();
      }
      
      if (!$(event.target).hasClass('ui-selected') && !event.metaKey) { // mouse down on non-selected item prep for drag
        this.possible_nonselected_drag = true;
      } else if (!$(event.target).hasClass('ui-selected') && event.metaKey) { // meta mouse down on a non-selected item
        // move the item that was meta mouse downed to a state of selected
        var selectee = $(event.target).data("selectable-item");
        selectee.$element.addClass('ui-selected');
        selectee.selected = true;
      } else if ($(event.target).hasClass('ui-selected') && event.metaKey) { // meta mouse down on an already selected item 
        // move the item that was meta mouse downed to a state of unselecting
        var selectee = $(event.target).data("selectable-item");
        selectee.$element.removeClass('ui-selected');
        selectee.selected = false;
        self._trigger("unselected", event, {
          unselected: selectee.element
        });
      }
      
      // prep logic for beginning a mouse drag
      if ($(event.target).hasClass('ui-selectee')) {
        this.element.data("dragee", event.target);
      }
      else {
        this.element.data("dragee", null);
      }
    },
    
    _mouseDrag: function(event) {
      var self = this;
      var dragee = self.element.data("dragee");
      var insertionPlaceHolder = self.element.data("insertionPlaceHolder");
      if( !dragee ) 
        return;
      
      this.lastPositionAbs = this.positionAbs;
      this.positionAbs = { top: event.pageY, left: event.pageX };
      
      if (this.dragged) { // have already initialized dragging
        // updated the helper by moving it the difference between the last
        // mouse position and the new mouse position.
        var cur_helper_pos = this.helper.offset();
        var new_offset = { top: (this.positionAbs.top - this.lastPositionAbs.top), left: (this.positionAbs.left - this.lastPositionAbs.left) };
        this.helper.css('top', (cur_helper_pos.top + new_offset.top));
        this.helper.css('left', (cur_helper_pos.left + new_offset.left));
        
        
        this.selectees.not(dragee).each(function(i, item) {
          if( self._isMouseOver($(this),event) ) {
            var dir = self._getDragVerticalDirection();
            if( dir == "down" ) {
              insertionPlaceHolder.insertAfter(item);
            } else {
              insertionPlaceHolder.insertBefore(item);
            }
          }
        });
        
        //Interconnect with droppables
    		if($.ui.ddmanager) $.ui.ddmanager.drag(this, event);
    		
      } else { // have NOT initialized dragging
        if (this._foobartitty(event)) {
          this.dragged = true;
          this.helper = self._createHelper(this.possible_nonselected_drag,dragee);
          this._cacheHelperProportions();
          this.currentItem = this.helper;
          
          //Prepare possible droppables
      		if($.ui.ddmanager) {
      			$.ui.ddmanager.current = this;
      			$.ui.ddmanager.prepareOffsets(this, event);
          }
      			
          $('body').append(this.helper);
        }        
      }
      return false;
    },
    
    _mouseStop: function(event) {
      console.log("in mouse stop");
      var self = this;
      var options = this.options;
      var dragee = self.element.data("dragee");
      var insertionPlaceHolder = self.element.data("insertionPlaceHolder");
      
      if (this.dragged) {
        this.dragged = false;
        this.helper.remove();
        insertionPlaceHolder.remove();
        self.element.data("dragee", null);
        
        //If we are using droppables, inform the manager about the drop
    		if ($.ui.ddmanager)
    			$.ui.ddmanager.drop(this, event);
      } else {
        // mouse up on a non-selected item
        if (!$(event.target).hasClass('ui-selected') && !event.metaKey) {
          // move all items that were previously selected to a state of unselected
          this.selectees.filter('.ui-selected').each(function() {
            var selectee = $.data(this, "selectable-item");
            selectee.$element.removeClass('ui-selected');
            selectee.selected = false;
            self._trigger("unselected", event, {
              unselected: selectee.element
            });
          });
          
          // move the item that was mouse downed on to a state of selected
          var selectee = $(event.target).data("selectable-item");
          selectee.$element.addClass('ui-selected');
          selectee.selected = true;
          
        // mouse up on an already selected item
        } else if ($(event.target).hasClass('ui-selected') && !event.metaKey) {
          // everything that was already selected should be put in state of unselected
          this.selectees.filter('.ui-selected').not($(event.target)).each(function() {
            var selectee = $.data(this, "selectable-item");
            selectee.$element.removeClass('ui-selected');
            selectee.selected = false;
            self._trigger("unselected", event, {
              unselected: selectee.element
            });
          });
        }        
      }
      this.possible_nonselected_drag = false;      
      this._trigger("stop", event);
      
      return false;
    },
    
    _isMouseOver: function(item, event) {
      var offset = item.offset();
      var w = item.outerWidth();
      var h = item.outerHeight();
      var dx = event.pageX - offset.left;
      var dy = event.pageY - offset.top;
      if( dx >= 0 && dx <= w && dy >= 0 && dy <= h )
        return true;
      else
        return false;
    },
    
    _getDragVerticalDirection: function() {
      var delta = this.positionAbs.top - this.lastPositionAbs.top;
      return delta != 0 && (delta > 0 ? "down" : "up");
    },
    
    _createHelper: function(nonselected_drag, dragee) {
      var container = $('<div style="position: absolute;"></div>');
      var clone = null;
      var offset = null;
      if( nonselected_drag ) {
        offset = $(dragee).offset();
        clone = $(dragee).clone();
        clone = $('<ul></ul>').append(clone);
      }
      else {
        // set offset to the offset of the first selected element
        offset = this.element.find('.ui-selected:first').offset();
        clone = this.element.clone();
        clone.find('.ui-selected').first().prevAll().remove();
        clone.find('.ui-selected').last().nextAll().remove();
        clone.find('.ui-selectee').not('.ui-selected').css('visibility', 'hidden');        
      }
      container.append(clone);
      container.css('opacity', 0.35);
      container.css('top', offset.top);
      container.css('left', offset.left);
      return container;
    }
  });
})(jQuery);
