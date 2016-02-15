'use strict';

var gulp = require('gulp');

// Utilities
gulp.task('flush', require('./tasks/flush'));

// Linting
gulp.task('eslint', require('./tasks/eslint'));

// Testing
gulp.task('test', ['eslint'], require('./tasks/test'));

// Main tasks
gulp.task('watch', require('./tasks/watch'));
gulp.task('default', ['test', 'watch']);
