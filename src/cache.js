var fs            = require('fs');
var path          = require('path');
var util          = require('util');

var array_detect = function(array, test) {
  var Result = function(v1, i1) {
    this.v = v1;
    this.i = i1;
  };

  try {
    array.filter(function(v, i, a) {
      if (test(v, i, a)) {
        throw new Result(v, i);
      }
    });
  } catch (error) {
    e = error;
    if (e instanceof Result) {
      return e.v;
    }
    throw e;
  }
};

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
  },



  cached_file_exists(filename) {
    var filename_only = path.basename(filename, path.extname(filename));

    return !!array_detect(fs.readdirSync(path.dirname(filename)), (file) => {
      return filename_only == path.basename(file, path.extname(file));
    });
  }
};