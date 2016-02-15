// Temporary work around, as gulp-tape doesn't reload required modules when they change
module.exports = function () {
  for (var prop in require.cache) {
    if (prop.indexOf("node_modules") === -1) {
      delete require.cache[prop];
    }
  }
}
