'use strict';

var gulp = require('gulp');

var config = require('../config');

module.exports = function() {
    return gulp.watch([config.paths.lib, config.paths.test], ['flush', 'test']);
};
