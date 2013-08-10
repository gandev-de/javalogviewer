Package.describe({
	summary: "custom bootstrap components"
});

Package.on_use(function(api) {
	api.add_files('datetimepicker/bootstrap-datetimepicker.min.js', 'client');
	api.add_files('datetimepicker/bootstrap-datetimepicker.min.css', 'client');

	api.add_files('multiselect/bootstrap-multiselect.js', 'client');
	api.add_files('multiselect/bootstrap-multiselect.css', 'client');

	api.use('less', 'client');
});