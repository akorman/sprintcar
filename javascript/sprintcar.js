/*
 * jQuery UI Sortable @VERSION
 *
 * Copyright 2010, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Sortables
 *
 * Thanks to the jquery.disable.text.select.js jQuery plugin for insight into
 * cross-browser ways to disable text select.
      * .disableTextSelect - Disable Text Select Plugin
      *
      * Version: 1.1
      * Updated: 2007-11-28
      *
      * Used to stop users from selecting text
      *
      * Copyright (c) 2007 James Dempster (letssurf@gmail.com, http://www.jdempster.com/category/jquery/disabletextselect/)
      *
      * Dual licensed under the MIT (MIT-LICENSE.txt)
      * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Depends:
 *  jquery.ui.core.js
 *  jquery.ui.mouse.js
 *  jquery.ui.widget.js
 */
(function($) {
  $.widget("ui.sprintcar", $.ui.mouse, {
    options: {
      appendTo: 'body',
      autoRefresh: true,
      connectWith: false,
      threshold: 10,
      distance: 0, // NOTE WE HAVE TO HAVE THIS TO HANDLE THRESHOLD DON'T CHANGE
      helper: "original",
      filter: '*',
      tolerance: 'touch',
      scope: 'default',
      refreshPositions: false,
      tolerance: 'intersect',
      scroll: true,
      scrollSensitivity: 20,
      scrollSpeed: 20,
      insert_pos_identifier: $('<div style="height: 2px; background-color: black;"></div>'),
      hover_region_threshold: (1.0 / 3.0)
    },
    
    /*
     * Construct the Sprintcar jquery-ui plugin on selector(s).
     *
     * This method constructs the plugin instance and it will be called once
     * for each unique selector instance in the selector set. Ex:
     *
     * $('#list').sprintcar({
     *   update: function(event, data) {
     *     alert("Updated order (serialized list follows): " + $('#list').sprintcar('serialize'));
     *   }
     * });
     *
     * For the above example _create() would only be called once for $("#list").
     */
    _create: function() {
      var self = this;
      
      // Disable text selection for the jquery object this plugin is bound to
      self._disable_text_selection(self.element);
      
      self.element.addClass("ui-selectable");
      
      self.dragged = false;
      self.possible_nonselected_drag = false;
      self.selection_stack = [];
      self.containers = null;
      self.current_item_hovered = null;
      self.current_item_hovered_region = null;
      
      // ensure hover_region_threshold is a sensible value.
      if( self.options.hover_region_threshold > 0.5 )
        self.options.hover_region_threshold = 0.5;
      
      /*
       * Refresh the plugins knowledge of what it is responsible for managing.
       *
       * This method is designed to be called in scenarios where you change
       * elements that the plugin is currently managing. For example, lets
       * say you called the plugin on page load and initialized sprintcar on
       * a list of items. Then through some user action a new item gets added
       * to that list. Now, that an external entity has added an item to the
       * area sprintcar is managing you need to tell sprintcar to refresh
       * itself and find any new elements it may need to manage.
       */
      self.refresh = function() {
        this.selectees = $(this.options.filter, this.element[0]);
        this.selectees.each(function() {
          var cur_selectee = $(this);
          var cur_selectee_pos = cur_selectee.offset();
          $.data(cur_selectee[0], "selectable-item", {
            element: cur_selectee[0],
            $element: cur_selectee,
            left: cur_selectee_pos.left,
            top: cur_selectee_pos.top,
            right: cur_selectee_pos.left + cur_selectee.outerWidth(),
            bottom: cur_selectee_pos.top + cur_selectee.outerHeight(),
            startselected: false,
            selected: cur_selectee.hasClass('ui-selected'),
            selecting: cur_selectee.hasClass('ui-selecting'),
            unselecting: cur_selectee.hasClass('ui-unselecting')
          });
          if( !cur_selectee.hasClass('ui-selectee') ) {
            cur_selectee.addClass('ui-selectee');
          }
        });
        
        // Add insertion position identifier to the dom and style it in prep
        // for use later on
        self.options.insert_pos_identifier.addClass("insert-pos-identifier");
        $("body").append(self.options.insert_pos_identifier);
        self.options.insert_pos_identifier.hide();
        self.options.insert_pos_identifier.css("position","absolute");
        self.options.insert_pos_identifier.css("width", self.selectees.eq(0).outerWidth());
        self.options.insert_pos_identifier.css("left", self.selectees.eq(0).offset().left);
        self.element.data("insert_pos_identifier", self.options.insert_pos_identifier);
        
    		if(self.options.connectWith != false) {
          self.containers = $(self.options.connectWith).not(self.element);
    		}
      };
      
      self.refresh();
      self._mouseInit();
      
      return self;
    },
        
    /*
     * Destruct the plugin.
     *
     * This method is called when the plugin is explicitly destructed or when
     * the element it is bound to is removed from the dom. It is responsible
     * for basically putting the element that the plugin was bound to and all
     * children it touches back in the state they would have been if the
     * plugin had not been initialized on the element. In general this is
     * simply removing classes and data from managed elements.
     */
    destroy: function() {
      var self = this;
      
      self.selectees
        .removeClass("ui-selectee")
        .removeData("selectable-item");
      self.element
        .removeClass("ui-selectable ui-selectable-disabled")
        .removeData("selectable")
        .unbind(".selectable");
      self._mouseDestroy();
      
      return self;
    },
    
    /*
     * Returns boolean identifying if mouse event has passed drag threshold.
     */
    _passed_drag_threshold: function(event) {
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
    
    /*
     * Called when the mouse down happens.
     *
     * Called by the ui.mouse jquery ui plugin that this plugin extends.
     */
    _mouseStart: function(event) {
      var self = this;
      var selectee;
      
      this.opos = [event.pageX, event.pageY];
      this.positionAbs = { top: event.pageY, left: event.pageX };
      
      if (this.options.disabled)
        return;
      
      var options = this.options;
      
      this._trigger("start", event);
      
      if (options.autoRefresh) {
        this.refresh();
      }
      
      if (!$(event.target).hasClass('ui-selected') && !event.metaKey && !event.shiftKey) { // mouse down on non-selected item prep for drag
        this.possible_nonselected_drag = true;
      } else if (!$(event.target).hasClass('ui-selected') && event.metaKey) { // meta mouse down on a non-selected item
        // move the item that was meta mouse downed to a state of selected
        selectee = $(event.target).data("selectable-item");
        if( selectee ) {
          selectee.$element.addClass('ui-selected');
          selectee.selected = true;
          self.selection_stack.push(selectee.element);
        }
      } else if ($(event.target).hasClass('ui-selected') && event.metaKey) { // meta mouse down on an already selected item 
        // move the item that was meta mouse downed to a state of unselecting
        selectee = $(event.target).data("selectable-item");
        selectee.$element.removeClass('ui-selected');
        selectee.selected = false;
        self._trigger("unselected", event, {
          unselected: selectee.element
        });
        var idx = $.inArray(selectee.element,self.selection_stack);
        if( idx != -1 ) {
          self.selection_stack.splice(idx,1);
        }
      } else if (!$(event.target).hasClass('ui-selected') && event.shiftKey) { // shift mouse down on non-selected item
        // check if there is already a selected item
          
          // if there is already a selected item find the most recently selected item
          
          // find the item that is being selected right now
          
          // select all the items between the most recently selected item and the currently being selected item inclusively
          
        // if nothing is selected yet
          
          // find the first item in the list
          
          // find the item that is being selected right now
          
          // select all items between the first item in the list and the currently being selected item inclusively
          var selection_length = self.selection_stack.length;
          if( selection_length > 0 ) {
            var last_selected = self.selection_stack[selection_length-1];
            selectee = $(event.target).data("selectable-item");
            // if we are shift selecting an already selected element, do nothing.
            if( selectee != last_selected ) {
              var selectee_first = null;
              self.selectees.each(function(i, item) {
                if( selectee_first === null ) {
                  if( item == selectee.element ) {
                    selectee_first = true;
                    $(item).addClass('ui-selected');
                    $(item).selected = true;
                  }
                  else if( item == last_selected ) {
                    selectee_first = false;
                  }
                }
                else {
                  if( selectee_first === true && item == last_selected ) {
                    return false;
                  }
                  else if( selectee_first === false && item == selectee.element ) {
                    $(item).addClass('ui-selected');
                    $(item).selected = true;
                    return false;
                  }
                  else {
                    $(item).addClass('ui-selected');
                    $(item).selected = true;
                  }
                }
                return true;
              });
            }
          }
          else {
            selectee = $(event.target).data("selectable-item");
            self.selectees.each(function(i, item) {
              $(item).addClass('ui-selected');
              $(item).selected = true;
              if( item == selectee.element ) {
                return false;
              }
            });
          }
          
          
      }
      
      // prep logic for beginning a mouse drag
      if ($(event.target).hasClass('ui-selectee')) {
        this.element.data("dragee", event.target);
      } else {
        this.element.data("dragee", null);
      }
    },
    
    /*
     * Called when the mouse drag happens.
     *
     * Called by the ui.mouse jquery ui plugin that this plugin extends.
     */    
    _mouseDrag: function(event) {
      var self = this;
      var dragee = self.element.data("dragee");
      if( !dragee ) {
        return false;
      }
      
      this.lastPositionAbs = this.positionAbs;
      this.positionAbs = { top: event.pageY, left: event.pageX };
      
      if (this.dragged) { // have already initialized dragging
      
        if( self.insideWidget(self.positionAbs) ) {
          //Do scrolling
          if(this.options.scroll) {
            var o = this.options, scrolled = false;
            if(this.scrollParent[0] != document && this.scrollParent[0].tagName != 'HTML') {

              if((this.overflowOffset.top + this.scrollParent[0].offsetHeight) - event.pageY < o.scrollSensitivity)
                this.scrollParent[0].scrollTop = scrolled = this.scrollParent[0].scrollTop + o.scrollSpeed;
              else if(event.pageY - this.overflowOffset.top < o.scrollSensitivity)
                this.scrollParent[0].scrollTop = scrolled = this.scrollParent[0].scrollTop - o.scrollSpeed;

              if((this.overflowOffset.left + this.scrollParent[0].offsetWidth) - event.pageX < o.scrollSensitivity)
                this.scrollParent[0].scrollLeft = scrolled = this.scrollParent[0].scrollLeft + o.scrollSpeed;
              else if(event.pageX - this.overflowOffset.left < o.scrollSensitivity)
                this.scrollParent[0].scrollLeft = scrolled = this.scrollParent[0].scrollLeft - o.scrollSpeed;

            } else {
              if(event.pageY - $(document).scrollTop() < o.scrollSensitivity)
                scrolled = $(document).scrollTop($(document).scrollTop() - o.scrollSpeed);
              else if($(window).height() - (event.pageY - $(document).scrollTop()) < o.scrollSensitivity)
                scrolled = $(document).scrollTop($(document).scrollTop() + o.scrollSpeed);

              if(event.pageX - $(document).scrollLeft() < o.scrollSensitivity)
                scrolled = $(document).scrollLeft($(document).scrollLeft() - o.scrollSpeed);
              else if($(window).width() - (event.pageX - $(document).scrollLeft()) < o.scrollSensitivity)
                scrolled = $(document).scrollLeft($(document).scrollLeft() + o.scrollSpeed);

            }

            if(scrolled !== false && $.ui.ddmanager && !o.dropBehaviour)
              $.ui.ddmanager.prepareOffsets(this, event);
          }

          self.updateInsertionPosition(event);
        }
        else {
          self.containers.each(function() {
            if( $(this).sprintcar("insideWidget", self.positionAbs) ) {
            }
            else {
            }
          });
        }    
        
        // updated the helper by moving it the difference between the last
        // mouse position and the new mouse position.
        var cur_helper_pos = this.helper.offset();
        var new_offset = { top: (this.positionAbs.top - this.lastPositionAbs.top), left: (this.positionAbs.left - this.lastPositionAbs.left) };
        this.helper.css('top', (cur_helper_pos.top + new_offset.top));
        this.helper.css('left', (cur_helper_pos.left + new_offset.left));        
        
        //Interconnect with droppables
        if($.ui.ddmanager) $.ui.ddmanager.drag(this, event);
        
      } else { // have NOT initialized dragging
        if (this._passed_drag_threshold(event)) {
          this.dragged = true;
          
          this.selectees.each(function(idx) {
            $(this).data('multidnd-index', idx);
          });
          
          this.helper = self._createHelper(this.possible_nonselected_drag,dragee);
          this._cacheHelperProportions();
          this.currentItem = this.helper;
  
          //Get the next scrolling parent
          this.scrollParent = this.selectees.eq(0).scrollParent();
          
          //Prepare scrolling
          if(this.scrollParent[0] != document && this.scrollParent[0].tagName != 'HTML')
            this.overflowOffset = this.scrollParent.offset();  
          
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
    
    /*
     * Called when the mouse up happens.
     *
     * Called by the ui.mouse jquery ui plugin that this plugin extends.
     */
    _mouseStop: function(event) {
      var self = this;
      var options = this.options;
      var dragee = self.element.data("dragee");
      var insert_pos_identifier = self.element.data("insert_pos_identifier");
      
      if (self.dragged) {
        if( self.insideWidget(self.positionAbs) ) {
          if( self.current_item_hovered_region ) {          
            var helperSelectees = $('.ui-selectee', this.helper).not('.ui-selectee-hidden');
            var orig_selectees_to_rem = [];
            helperSelectees.each(function() {
              var index = $(this).data('multidnd-index');
              var origSelectee = self.selectees.filter(function() {
                return ($(this).data('multidnd-index') == index);
              });
              origSelectee.hide();
              orig_selectees_to_rem.push(origSelectee);
            });

            self._unselect_all_selected(self.selectees);
          
            if( self.current_item_hovered_region.top ) {
              helperSelectees.insertBefore(self.current_item_hovered);
            }
            else if( self.current_item_hovered_region.bottom ) {
              helperSelectees.insertAfter(self.current_item_hovered);            
            }
            $(orig_selectees_to_rem).each(function () {
              this.remove();
            });
          
            $.ui.ddmanager.current = null;
            self.refresh();
            //self._unselect_all_selected(self.selectees);
            self._populate_selection_stack_with_selected(self.selectees);
            self._trigger('update', event, this._uiHash());
          }
        } else {
          //If we are using droppables, inform the manager about the drop
          if ($.ui.ddmanager)
            $.ui.ddmanager.drop(this, event);
        }
        
        this.dragged = false;
        insert_pos_identifier.hide();
        self.element.data("dragee", null);
        self.helper.remove();
        this.helper = null;
        this.currentItem = null;
      } else {
        // mouse up on a non-selected item
        if (!$(event.target).hasClass('ui-selected') && !event.metaKey && !event.shiftKey) {
          // move all items that were previously selected to a state of unselected
          self._unselect_all_selected(self.selectees);
          
          // move the item that was mouse downed on to a state of selected
          var selectee = $(event.target).data("selectable-item");
          if( selectee ) {
            selectee.$element.addClass('ui-selected');
            selectee.selected = true;
            self.selection_stack.push(selectee.element);
          }
        // mouse up on an already selected item
        } else if ($(event.target).hasClass('ui-selected') && !event.metaKey && !event.shiftKey) {
          // everything that was already selected should be put in state of unselected
          self._unselect_all_selected(this.selectees.not($(event.target)));
        }
      }
      this.possible_nonselected_drag = false;
      this._trigger("stop", event);
      
      return false;
    },
    
    updateInsertionPosition: function(event) {
      var self = this;
      var insert_pos_identifier = self.element.data("insert_pos_identifier");
      this.selectees.each(function(i, item) {
        var hover_region = self._getItemHoverRegion($(this), event);
        var dir = self._getDragVerticalDirection();
        if( hover_region ) {
          self.current_item_hovered = $(item);
          var margin = (self.current_item_hovered.outerHeight(true) - self.current_item_hovered.innerHeight()) / 2;
          var offset = margin / 2;

          if( hover_region.top && dir == "up" ) {
            insert_pos_identifier.css('top', self.current_item_hovered.offset().top - offset - 1);
          }
          else if( hover_region.top && dir == "down" ) {
            insert_pos_identifier.css('top', self.current_item_hovered.offset().top - offset - 1);
          }
          else if( hover_region.bottom && dir == "down" ) {
            insert_pos_identifier.css('top', self.current_item_hovered.offset().top + self.current_item_hovered.outerHeight() + offset - 1);
          }
          else if( hover_region.bottom && dir == "up" ) {
            insert_pos_identifier.css('top', self.current_item_hovered.offset().top + self.current_item_hovered.outerHeight() + offset - 1);              
          }
          if( hover_region.top || hover_region.bottom ) {
            self.current_item_hovered_region = hover_region;              
            insert_pos_identifier.show();
          }
        }
      });
    },
        
    _getItemHoverRegion: function(item, event) {
      var self = this;

      var sp = self.scrollParent;
      var pos = sp.offset();
      
      if ((event.pageX < pos.left) || (event.pageY < pos.top)) {
        return null;
      }
      
      if ((event.pageX > (pos.left + sp.width())) || (event.pageY > (pos.top + sp.height()))) {
        return null;
      }
      
      var result = { top: false, bottom: false, left: false, right: false };
      var offset = item.offset();
      var w = item.outerWidth();
      var h = item.outerHeight();
      var dx = event.pageX - offset.left;
      var dy = event.pageY - offset.top;

      if( dy > 0 && dy < (h * self.options.hover_region_threshold) )
        result.top = true;
      else if( dy > (h * (1.0 - self.options.hover_region_threshold)) && dy < h )
        result.bottom = true;

      if( dx > 0 && dx < w && dy > 0 && dy < h  )
        return result;
      else
        return null;
     },
    
    _getDragVerticalDirection: function() {
      var delta = this.positionAbs.top - this.lastPositionAbs.top;
      return (delta > 0 ? "down" : "up");
    },
    
    _createHelper: function(nonselected_drag, dragee) {
      var self = this;
      var container = $('<div style="position: absolute;"></div>');
      container.css("width", self.element.width());
      var clone = null;
      var offset = null;
      if( nonselected_drag ) {
        offset = $(dragee).offset();
        clone = $(dragee).clone(true);
        clone = $('<' + self.element[0].tagName + '></' + self.element[0].tagName + '>').append(clone);
      }
      else {
        // set offset to the offset of the first selected element
        offset = this.element.find('.ui-selected:first').offset();
        // clone = this.element.clone(true);
        // I tried to use the above but it has problems because when you clone
        // the jquery object it keeps its links to the plugin and when you
        // then try and remove the helper later in code it triggers the
        // destroy method on this object in turn removing all the state and
        // applied classes rendering the plugin useless.
        clone = $('<' + self.element[0].tagName + '></' + self.element[0].tagName + '>');
        self.element.children().each(function() {
          $(this).clone(true).appendTo(clone);
        });
        
        clone.find('.ui-selected').first().prevAll().remove();
        clone.find('.ui-selected').last().nextAll().remove();
        clone.find('.ui-selectee').not('.ui-selected').addClass('ui-selectee-hidden');
      }
      container.append(clone);
      container.css('opacity', 0.35);
      container.css('top', offset.top);
      container.css('left', offset.left);
      return container;
    },
    
    insideWidget: function(pos) {
      var contPos = this.element.offset();
      var contDim = { width: this.element.outerWidth(), height: this.element.outerHeight() };
      
      if( pos.top > contPos.top &&
          pos.left > contPos.left &&
          pos.top < (contPos.top + contDim.height) &&
          pos.left < (contPos.left + contDim.width) )
      {
          return true;
      }
      return false;
    },
    
    _uiHash: function(inst) {
      var self = inst || this;
      return {
        helper: self.helper,
        placeholder: self.placeholder || $([]),
        position: self.position,
        originalPosition: self.originalPosition,
        offset: self.positionAbs,
        item: self.currentItem,
        sender: inst ? inst.element : null
      };
    },
    
    serialize: function(o) {
      var items = this.selectees;
      var str = []; o = o || {};
      
      $(items).each(function() {
        var res = ($(o.item || this).attr(o.attribute || 'id') || '').match(o.expression || (/(.+)[-=_](.+)/));
        if(res) str.push((o.key || res[1]+'[]')+'='+(o.key && o.expression ? res[1] : res[2]));
      });
      
      if(!str.length && o.key) {
        str.push(o.key + '=');
      }
      
      return str.join('&');
    },
    
    /*
     * Disable text selection for the jquery object passed in.
     */
    _disable_text_selection: function(e) {
      if ($.browser.mozilla) {
        e.css({ 'MozUserSelect' : 'none' });
      } else if ($.browser.msie) {
        e.bind('selectstart.disableTextSelect', function() { return false; });
      } else {
        e.bind('mousedown.disableTextSelect', function() { return false; });
      }
    },
    
    /*
     * Enable text selection for the jquery object passed in.
     */
    _enable_text_selection: function(e) {
      if ($.browser.mozilla) {
        e.css({ 'MozUserSelect' : '' });
      } else if ($.browser.msie) {
        e.unbind('selectstart.disableTextSelect');
      } else {
        e.unbind('mousedown.disableTextSelect');
      }
    },
    
    _unselect_all_selected: function(objs) {
      var self = this;
      
      objs.filter('.ui-selected').each(function() {
        var selectee = $.data(this, "selectable-item");
        selectee.$element.removeClass('ui-selected');
        selectee.selected = false;
        self._trigger("unselected", null, {
          unselected: selectee.element
        });
        var idx = $.inArray(selectee.element,self.selection_stack);
        if( idx != -1 ) {
          self.selection_stack.splice(idx,1);
        }
      });
    },
    
    _populate_selection_stack_with_selected: function(objs) {
      var self = this;
      objs.filter('.ui-selected').each(function() {
        var selectee = $.data(this, "selectable-item");
        self.selection_stack.push(selectee.element);
      });
    }
    
  });
})(jQuery);
