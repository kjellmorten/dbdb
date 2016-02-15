'use strict';

var gulp = require('gulp');
var tape = require('gulp-tape');
var tapMin = require('tap-min');
var env = require('gulp-env');

var config = require('../config');

module.exports = () => {
  var envs = env.set({
    NODE_ENV: 'test'
  });
  return gulp.src(config.paths.test)
    .pipe(tape({
      reporter: tapMin()
    }))
    .pipe(envs.reset);
};
