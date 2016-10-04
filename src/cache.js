var fs            = require('fs');
var path          = require('path');
var util          = require('util');

module.exports = {
  ensure_cache_dir_exists(dir) {
    var full_path, stat;

    try {
      full_path = path.resolve('cache');
      stat = fs.statSync(full_path);
    }
    catch(err) {
      fs.mkdirSync(full_path);
    }

    try {
      full_path = path.resolve(full_path, dir);
      stat = fs.statSync(full_path);
    }
    catch(err) {
      fs.mkdirSync(full_path);
    }
  },

  get_cached_absolute_path(type, filename) {
    this.ensure_cache_dir_exists(type);

    return path.resolve('cache', type, filename);
  },

  get_url_from_cached_file(filename) {
    return filename.replace(/^.*?\/?cache\//i, '');
  }
}