'use strict';

var gulp = require('gulp'),
    eslint = require('gulp-eslint');

var config = require('../config');

module.exports = function() {
    return gulp.src([config.paths.lib, config.paths.test])
        .pipe(eslint())
        .pipe(eslint.format());
        //.pipe(eslint.failAfterError());
};
