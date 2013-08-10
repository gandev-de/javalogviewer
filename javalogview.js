Log = new Meteor.Collection("log", {
  transform: function(doc) {
    var pad = function(number) {
      var r = String(number);
      if (r.length === 1) {
        r = '0' + r;
      }
      return r;
    };

    var when = new Date(doc.when);
    doc.when = when.getFullYear() + '.' +
      (pad(when.getMonth() + 1)) + '.' +
      pad(when.getDate()) + ' ' +
      pad(when.getHours()) + ':' +
      pad(when.getMinutes()) + ':' +
      pad(when.getSeconds()) + '.' +
      when.getMilliseconds();
    return doc;
  }
});

Locations = new Meteor.Collection("locations");

if (Meteor.isClient) {
  var filter_data = {};
  Session.set("log_page", 0);
  Session.set("pages_count", 0);

  Meteor.subscribe("locations");

  Deps.autorun(function() {
    //Session.get("load_log");

    Meteor.subscribe("log", {
      start: filter_data.start_date,
      end: filter_data.end_date,
      classes: filter_data.class_select,
      methods: filter_data.method_select,
      reactive: Session.get("load_log") //neccessary because no rerun without something reactive
    }); //TODO Server side pagination, Session.get("log_page"), 5);

    console.log("filter applied: ", new Date(filter_data.start_date),
      new Date(filter_data.end_date),
      filter_data.class_select,
      filter_data.method_select);
  });

  var PAGE_ENTRIES = 20;
  var pages = [];

  Template.log.helpers({
    log: function() {

      var entries = Log.find({}, {
        sort: {
          when: -1
        }
      }).fetch();

      pages = [];
      for(var i = 0, p = 1; i < entries.length; i += PAGE_ENTRIES, p++) {
        var idx = i === 0 ? 1 : i;
        pages.push(p);
      }
      Session.set("pages_count", pages.length);

      var page = Session.get("log_page");
      var start_idx = (page - 1) * PAGE_ENTRIES;
      var end_idx = start_idx + PAGE_ENTRIES;

      return entries.slice(start_idx, end_idx);
    },
    log_pages: function() {
      Session.get("pages_count");
      return pages;
    },
    log_page_selected_class: function() {
      return Session.equals("log_page", +this) ? 'active': '';
    },
    level_class: function() {
      var log_entry = this;
      var level = log_entry.what.level;
      if (level === "INFO") {
        return "info";
      } else if (level === "WARNING") {
        return "warning";
      } else if (level === "SEVERE") {
        return "error";
      } else {
        return "success";
      }
    }
  });

  Template.log.events({
    'click #log_page_back': function(evt, tmpl) {
      var pages_count = Session.get("pages_count");
      var page = Session.get("log_page");
      if(page > 1) {
        Session.set("log_page", --page);
      }
    },
    'click #log_page_forward': function(evt, tmpl) {
      var pages_count = Session.get("pages_count");
      var page = Session.get("log_page");
      if(page < pages_count) {
        Session.set("log_page", ++page);
      }
    },
    'click .log_page': function(evt, tmpl) {
      Session.set("log_page", +evt.currentTarget.innerHTML);
    }
  });

  Template.controls.helpers({
    classes: function() {
      var locations = Locations.findOne() || {};
      return locations.classes || [];
    },
    methods: function() {
      var locations = Locations.findOne() || {};
      return locations.methods || [];
    }
  });

  Template.controls.rendered = function() {
    var self = Template.controls;

    var pick_start = $('#pick_start').datetimepicker({
      language: 'en',
      pick12HourFormat: false
    });
    pick_start.on('changeDate', function(e) {
      filter_data.start_date = e.localDate.getTime();
      Session.set("load_log", Random.id());
    });
    var date_start = new Date();
    date_start.setFullYear(date_start.getFullYear() - 1);
    pick_start.data("datetimepicker").setLocalDate(date_start);
    filter_data.start_date = date_start.getTime();

    var pick_end = $('#pick_end').datetimepicker({
      language: 'en',
      pick12HourFormat: false
    });
    pick_end.on('changeDate', function(e) {
      filter_data.end_date = e.localDate.getTime();
      Session.set("load_log", Random.id());
    });
    var end_date = new Date();
    pick_end.data('datetimepicker').setLocalDate(end_date);
    filter_data.end_date = end_date.getTime();
  };

  Template.csel.rendered = function() {
    $('#class_sel').multiselect({
      buttonClass: 'btn',
      buttonWidth: 'auto',
      buttonContainer: '<div class="btn-group" />',
      maxHeight: false,
      buttonText: function(options) {
        if (options.length === 0) {
          return 'None selected <b class="caret"></b>';
        } else if (options.length > 3) {
          return options.length + ' selected  <b class="caret"></b>';
        } else {
          var selected = '';
          options.each(function() {
            selected += $(this).text() + ', ';
          });
          return selected.substr(0, selected.length - 2) + ' <b class="caret"></b>';
        }
      },
      onChange: function(element, checked) {
        if (checked === true) {
          filter_data.class_select = filter_data.class_select || [];
          filter_data.class_select.push(element.val());
        } else if (checked === false) {
          filter_data.class_select = _.filter(filter_data.class_select, function(class_name) {
            return class_name !== element.val();
          });
        }
        Session.set("load_log", Random.id());
      }
    });
  };

  Template.msel.rendered = function() {
    $('#method_sel').multiselect({
      buttonClass: 'btn',
      buttonWidth: 'auto',
      buttonContainer: '<div class="btn-group" />',
      maxHeight: false,
      buttonText: function(options) {
        if (options.length === 0) {
          return 'None selected <b class="caret"></b>';
        } else if (options.length > 3) {
          return options.length + ' selected  <b class="caret"></b>';
        } else {
          var selected = '';
          options.each(function() {
            selected += $(this).text() + ', ';
          });
          return selected.substr(0, selected.length - 2) + ' <b class="caret"></b>';
        }
      },
      onChange: function(element, checked) {
        if (checked === true) {
          filter_data.method_select = filter_data.method_select || [];
          filter_data.method_select.push(element.val());
        } else if (checked === false) {
          filter_data.method_select = _.filter(filter_data.method_select, function(class_name) {
            return class_name !== element.val();
          });
        }
        Session.set("load_log", Random.id());
      }
    });
  };
}