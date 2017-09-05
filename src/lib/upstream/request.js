import tough from 'tough-cookie';
import requestLib from 'request';
import file_cookie_store from "tough-cookie-file-store";
import fs from 'fs';
import path from 'path';
import util from 'util';
import redis from 'redis';
import mime from 'mime';

import { pass_challenge } from './pass_challenge';
import { CACHE_ENABLED, REQUEST_HEADERS } from '../constants';

const redis_client  = redis.createClient({
  host: 'localhost',
  port: 6379,
  db: 15
});

const get_cookie_filename = () => {
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

const cookieStore = new file_cookie_store(get_cookie_filename())

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

redis_client.on("error", function (err) {
  console.log(`[REDIS] Error ${err}`);
});

const request = requestLib.defaults({
  jar: requestLib.jar(cookieStore),
  gzip: true
});

const getCookiesFromResponse = (response) => {
  let cookies = {};
  const cookieStoreCookies = cookieStore.idx['readcomiconline.to']['/'];
  const cookiesSet = response.headers['set-cookie'] || [];

  // Build the object with the current cookies
  for(var key in cookieStoreCookies) {
    cookies[key] = cookieStoreCookies[key].value;
  }

  // Add/update the ones being set by the request
  cookiesSet.reduce((obj, item) => {
    let match = item.match(/^(.*?)=(.*?);/);
    obj[match[1]] = match[2];
    return obj;
  }, cookies);

  return cookies;
};

const createCookieJarStoreWithAuth = (authData) => {
  const { username, password, sessionId } = authData;
  const cookieStoreCookies = cookieStore.idx['readcomiconline.to']['/'];
  const cookieJar = new tough.CookieJar();
  const usernameCookie = `username=${username}; path=/; domain=readcomiconline.to`;
  const passwordCookie = `password=${password}; path=/; domain=readcomiconline.to`;
  const sessionIdCookie = `ASP.NET_SessionId=${sessionId}; path=/; domain=readcomiconline.to`;

  // Copy cookies from default store
  for(var key in cookieStoreCookies) {
    cookieJar.setCookieSync(cookieStoreCookies[key], 'http://readcomiconline.to/');
  }

  // Set auth cookies
  cookieJar.setCookieSync(usernameCookie, 'http://readcomiconline.to/');
  cookieJar.setCookieSync(passwordCookie, 'http://readcomiconline.to/');
  cookieJar.setCookieSync(sessionIdCookie, 'http://readcomiconline.to/');

  return cookieJar.store;
};

const server_request = (request_options) => {
  const hasAuth = !!request_options.authData;

  var from_cache = false;

  if (typeof request_options == 'string') {
    request_options = {
      url: request_options,
      headers: REQUEST_HEADERS
    };
  }
  else if (typeof request_options == 'object') {
    Object.assign(request_options, {
      headers: Object.assign(REQUEST_HEADERS, request_options.headers)
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

  // Use a new cookie jar with authData
  if (!!request_options.authData) {
    request_options.jar = request.jar(createCookieJarStoreWithAuth(request_options.authData));
    // delete request_options.authData;
  }

  var p = new Promise((resolve, reject) => {
    var _server = () => {
      console.log(`--- Making new request (${(request_options.method || 'get').toUpperCase()}) ---`);
      console.log('URL:', request_options.url);
      console.log(`Headers:`);

      for(var key in request_options.headers) {
        console.log(`- ${key}: ${request_options.headers[key]}`);
      }

      if (!!request_options.body) {
        console.log(`Body: ${request_options.body}`);
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

              server_request(challenge_options)
                .then(() => { server_request(request_options).then(resolve); });
            });
        }
        else {
          console.log('Challenge has been passed');

          if (hasAuth) {
            const loggedInRegex = new RegExp('<div id="menu_box" style="display: none">');
            if (!loggedInRegex.test(response.body)) {
              reject('UNAUTHORIZED');
              return;
            }
          }

          try {
            resolve({
              error: error,
              response: response,
              cookies: getCookiesFromResponse(response),
              body: body
            });
          }
          catch (error) {
            console.log(error);
          }
          finally {
            // Remove any username or password cookies that may have been set
            cookieStore.removeCookie('readcomiconline.to', '/', 'username', () => {});
            cookieStore.removeCookie('readcomiconline.to', '/', 'password', () => {});
          }
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

    if (CACHE_ENABLED) {
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
            _server();
          }
        });
      }
      else {
        _server();
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
      _server();
    }
  });

  p.__name = `Make request [${request_options.url}]`;
  return p;
};

const download = (url, filename) => {
  var p = new Promise((resolve, reject) => {
    var request_options = {
      url: url,
      headers: {
        "Upgrade-Insecure-Requests": '1',
        "User-Agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36',
        "Accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        "Referer": url,
        "Accept-Encoding": 'gzip, deflate, sdch',
        "Accept-Language": 'en-GB,en;q=0.8'
      }
    };

    if (url.match(/^https?:\/\/readcomiconline\.to\//))
      request_options.headers['Host'] = 'readcomiconline.to';

    console.log(`Downloading: ${url}`);

    request(Object.assign({}, request_options, { method: 'head' }), function(err, res, body) {
      try {
        filename = `${filename}.${mime.extension(res.headers['content-type'])}`;
        request(request_options)
          .pipe(fs.createWriteStream(filename))
          .on('close', () => { resolve(filename); });
      }
      catch(e) {
        console.log('error downloading');
        console.log(err);

        reject();
      }
    });
  });

  p.__name = 'Download cover';

  return p;
};

export {
  server_request,
  download
};
