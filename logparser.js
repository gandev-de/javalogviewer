var parseInfo = function(info) {
	var months = {
		"Januar": "01",
		"Februar": "02",
		"März": "03",
		"April": "04",
		"Mai": "05",
		"Juni": "06",
		"Juli": "07",
		"August": "08",
		"September": "09",
		"October": "10",
		"November": "11",
		"Dezember": "12"
	};

	var parseDate = function() {
		var date_str = info.substring(0, info.search(/(AM|PM)/g) + 2);
		//Mai 28, 2013 12:28:59 AM  --->  2011-10-20T14:48:00
		date_str = date_str.replace(", ", "#");
		date_str = date_str.replace(/ /g, "#");
		date_str = date_str.replace(/[:]/g, "#");
		var date_parts = date_str.split("#");
		var month = months[date_parts[0]];
		var day = date_parts[1].length == 1 ? "0" + date_parts[1] : date_parts[1];
		var year = date_parts[2];
		var hour = +date_parts[3];
		var minutes = date_parts[4];
		var seconds = date_parts[5];
		if (date_parts[6] === "AM" && hour === 12) {
			hour = "00";
		} else if (date_parts[6] === "AM" && hour > 9) {
			hour = "" + hour;
		} else {
			hour = "0" + hour;
		}

		if (date_parts[6] === "PM" && hour === 12) {
			hour = "" + hour;
		} else if (date_parts[6] === "PM") {
			hour = parseInt(hour, 10) + 12;
		}
		date_str = year + "-" + month + "-" + day + "T" + hour + ":" + minutes + ":" + seconds;
		//console.log(Date.parse(date_str));
		return Date.parse(date_str);
	};

	var parseLocation = function() {
		var location = info.substr(info.search(/(AM|PM)/g) + 3).split(" ");
		return {
			clazz: location[0],
			method: location[1]
		};
	};

	return {
		when: parseDate(),
		where: parseLocation()
	};
};

var parseContent = function(content) {
	var levels = [{
		lvl_search: "Information:",
		lvl: "INFO"
	}, {
		lvl_search: "Warnung:",
		lvl: "WARNING"
	}, {
		lvl_search: "Schwerwiegend:",
		lvl: "SEVERE"
	}];

	var search_idx = -1;
	var level = _.find(levels, function(level) {
		search_idx = content.indexOf(level.lvl_search);
		return search_idx >= 0;
	});

	content = level ? content.substr(search_idx + level.lvl_search.length + 1) : content;
	content = content.replace("\r", "");
	return {
		level: level && level.lvl,
		data: content
	};
};

if (Meteor.isServer) {
	var fs = Npm.require("fs");

	Meteor.publish("locations", function() {
		var self = this;
		var methods = [];
		var classes =   [];

		var check_location = function(location) {
			var method = location.where.method;
			var clazz = location.where.clazz;

			methods.push(method);
			methods = _.uniq(methods);

			classes.push(clazz);
			classes = _.uniq(classes);
		};

		var initializing = true;
		var log_cursor = Log.find({}, {
			fields: {
				'where': 1
			}
		});

		var handle = log_cursor.observe({
			added: function(doc) {
				check_location(doc);
				if (!initializing) {
					self.changed("locations", 0, {
						methods: methods,
						classes: classes
					});
				}
			}
		});

		initializing = false;
		self.added("locations", 0, {
			methods: methods,
			classes: classes
		});
		self.ready();

		self.onStop(function() {
			handle.stop();
		});
	});

	Meteor.publish("log", function(options, offset, limit) {
		var query = {
			'when': {
				'$gte': options.start,
				'$lte': options.end
			},
			'$or': [{
				'where.clazz': {
					'$in': options.classes || []
				}
			}, {
				'where.method': {
					'$in': options.methods || []
				}
			}]
		};
		var log_cursor = Log.find(query, {
			//limit: limit,
			sort: {
				when: -1
			}
		});
		console.log("change log subscription: ", log_cursor.count(), " -> ", options);
		return log_cursor;
	});

	var parser_func = Meteor.bindEnvironment(function(data) {
		//Mai 28, 2013 12:28:59 AM de.hpc.hc.modbus.Slave$1 update
		var info_line_regex = /\S* \S*[,] \d\d\d\d \d{1,2}[:]\d\d[:]\d\d (AM|PM).*/g;

		var entries = data.toString().split('\n');
		var content;
		for (var i = 0; i < entries.length; i++) {
			var entries_line = entries[i];
			var info_line = entries_line.match(info_line_regex);
			if (info_line) {
				content && Log.insert(content);
				content = parseInfo(info_line[0]);
			} else if (content && entries_line.length > 1) {
				content.what = content.what || {};
				content.what.data = content.what.data || [];
				var c = parseContent(entries_line);
				content.what.level = content.what.level || c.level;
				content.what.data.push(c.data);
			}
		}
		// content && entries_filtered.push(content);
		content && Log.insert(content);

		// console.log(entries_filtered);
	}, function(err) {
		console.log(err);
	});

	Meteor.startup(function() {
		// code to run on server at startup
		Log.remove({});

		fs.readFile('/Users/ares/Downloads/log/Log_Service.txt.2', function(err, data) {
			if (err) throw err;

			parser_func(data);
		});
	});
}