// var pass_challenge = require('./pass_challenge_phantom');
var pass_challenge = require('./pass_challenge');
var request = require('request');
var file_cookie_store = require("tough-cookie-filestore");
var fs            = require('fs');
var path          = require('path');
var util          = require('util');
var redis         = require('redis');
var mime          = require('mime');
var redis_client  = redis.createClient({
  host: 'localhost',
  port: 6379,
  db: 15
});

var cache_enabled = true;

var ensure_cache_dir_exists = (dir) => {
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
};

var get_cached_absolute_path = (type, filename) => {
  ensure_cache_dir_exists(type);

  return path.resolve('cache', type, filename);
};

var get_cookie_filename = () => {
  var full_path, stat;

  // Ensure that the cookies file exists
  try {
    full_path = path.resolve('cookies.json');
    stat = fs.statSync(full_path);
  }
  catch(err) {
    var fd = fs.openSync(full_path, 'w');
    fs.closeSync(fs.openSync(full_path, 'w'));
  }

  return full_path;
};

redis_client.on("error", function (err) {
  console.log(`[REDIS] Error ${err}`);
});

request = request.defaults({
  // proxy: 'http://localhost:8888',
  jar: request.jar(new file_cookie_store(get_cookie_filename())),
  gzip: true
});

var make_request = (request_options) => {
  var from_cache = false;
  var request_headers = {
    "Host": 'readcomiconline.to',
    "Upgrade-Insecure-Requests": '1',
    "User-Agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36',
    "Accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    "Accept-Encoding": 'gzip, deflate, sdch',
    "Accept-Language": 'en-GB,en;q=0.8'  
  };

  if (typeof request_options == 'string') {
    request_options = {
      url: request_options,
      headers: request_headers
    };
  }
  else if (typeof request_options == 'object') {
    Object.assign(request_options, {
      headers: Object.assign(request_headers, request_options.headers)
    }, request_options);
  }

  if (!!request_options.qs) {
    var query_string_parameters = [];

    for(var key in request_options.qs) {
      query_string_parameters.push(`${key}=${request_options.qs[key]}`);
    }

    request_options.url += `?${query_string_parameters.join('&')}`;
    delete request_options.qs;
  }

  var p = new Promise((resolve, reject) => {
    var _make_request = () => {
      console.log(`--- Making new request (${(request_options.method || 'get').toUpperCase()}) ---`);
      console.log('URL:', request_options.url);
      console.log(`Headers:`);

      if (!!request_options.body) {
        console.log(`Body: ${request_options.body}`);
      }

      for(var key in request_options.headers) {
        console.log(`- ${key}: ${request_options.headers[key]}`);
      }

      request(request_options, (error, response, body) => {
        if (body.match(/challenge-form/)) {
          console.log('Challenge necessary, trying to pass it');

          pass_challenge(request_options.url, body)
            .then((challenge_options) => {
              console.log('Challenge options:');
              console.log('url:', challenge_options.url);
              console.log('headers:', challenge_options.headers);
              
              console.log('------- Challenge options: -------');
              console.log(challenge_options.headers["Referer"], request_options.headers["Referer"], request_options.url);

              if (!!request_options.headers.Referer) {
                challenge_options.headers.Referer = request_options.headers.Referer;
              }

              console.log(challenge_options.headers["Referer"], request_options.headers["Referer"], request_options.url);
              console.log('------- /Challenge options: -------');
              
              challenge_options.from_cache = false;

              make_request(challenge_options)
                .then(resolve);
            });
        }
        else {
          console.log('Challenge has been passed');
          // console.log('error', error);
          // console.log('response', response);
          // console.log('body', body);

          resolve({
            error: error,
            response: response,
            body: body
          });
        }
      });
    };

    var _save_to_redis = (response) => {
      if (!!response.from_cache) {
        console.log('Response from cache, ignore');
        return;
      }
      else {
        if (!!response.result) {
          console.log('Response ready, saving to Redis');
          // console.log('setting', response.result, 'into redis key', request_options.cache_key);
          redis_client.setex(request_options.cache_key, 30 * 60 * 60 * 24, JSON.stringify(response.result));
        }
        else {
          console.log('Response not ready, re-adding. Promise name:', p.__name);
          setTimeout(() => {
            p.then(_save_to_redis);
          }, 0);
        }
      }
    };
    
    if (cache_enabled) {
      if (!!request_options.cache_key) {
        console.log('Cache key is set:', request_options.cache_key, '- searching Redis');

        redis_client.get(request_options.cache_key, (err, reply) => {
          if (reply) {
            from_cache = true;

            resolve({
              from_cache: true,
              data: JSON.parse(reply.toString())
            });
          }
          else {
            _make_request();
          }
        });
      }
      else {
        _make_request();
      }

      if (!from_cache && !!request_options.cache_key) {
        setTimeout(() => {
          console.log('Setting handler to write to cache');

          p.then(_save_to_redis);
        }, 0);
      }
    }
    else {
      console.log('Cache is disabled!');
      _make_request();
    }
  });

  p.__name = `Make request [${request_options.url}]`;
  return p;
};


var make_download = (url, filename) => {
  var p = new Promise((resolve, reject) => {
    var request_options = {
      url: url,
      headers: {
        "Host": 'readcomiconline.to',
        "Upgrade-Insecure-Requests": '1',
        "User-Agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36',
        "Accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        "Referer": url,
        "Accept-Encoding": 'gzip, deflate, sdch',
        "Accept-Language": 'en-GB,en;q=0.8'  
      }
    };

    // request(request_options)
    //   .pipe(fs.createWriteStream(filename))
    //   .on('close', () => { resolve(filename); });


    request(Object.assign({}, request_options, { method: 'head' }), function(err, res, body) {
      filename = `${filename}.${mime.extension(res.headers['content-type'])}`;
      console.log('filename', filename);
      request(request_options)
        .pipe(fs.createWriteStream(filename))
        .on('close', () => { resolve(filename); });
    });
  });

  p.__name = 'Download cover';

  return p;
};

Object.assign(module.exports, {
  make_request: make_request,
  download: make_download
});