import * as responses from '../lib/responses';
var express         = require('express');
var cheerio         = require('cheerio');
var app             = express();
import upstream from '../lib/upstream';
var router          = express.Router();
var stringify       = require('node-stringify');
var pathToRegexp    = require('path-to-regexp');
var cache           = require('../lib/cache');
var async           = require('async');
import { ROUTES } from '../lib/constants';
import * as helper from '../lib/helpers/comics';

const GENRES = [ 'Action', 'Adventure', 'Anthology', 'Anthropomorphic', 'Biography', 'Children', 'Comedy', 'Crime'
  , 'Drama', 'Family', 'Fantasy', 'Fighting', 'Graphic Novels', 'Historical', 'Horror', 'Leading Ladies', 'LGBTQ'
  , 'Literature', 'Manga', 'Martial Arts', 'Mature', 'Military', 'Movies & TV', 'Mystery', 'Mythology', 'Personal'
  , 'Political', 'Post-Apocalyptic', 'Psychological', 'Pulp', 'Religious', 'Robots', 'Romance', 'School Life'
  , 'Sci-Fi', 'Slice of Life', 'Sport', 'Spy', 'Superhero', 'Supernatural', 'Suspense', 'Thriller', 'Vampires'
  , 'Video Games', 'War', 'Western', 'Zombies' ];

var get_cache_key = (template, data) => {
  return pathToRegexp.compile(template)(data);
};

var check_for_cached_response = (request_stream, response_stream, response, callback) => {
  if (response.from_cache) {
    response_stream.json(response.data);
  }
  else {
    callback(response, request_stream)
      .then((result) => {
        response.result = result;
        response_stream.json(response.result);
      })
      .catch((reason) => {
        console.log(reason);
      });
  }
};

var handle_simple_comic_listing_request = (type) => {
  return (req, res) => {
    var url = `http://readcomiconline.to/${type}/${req.params.name}`;
    var url_params = {};

    if (!!req.params.page) {
      url_params.page = req.params.page;
    }

    upstream.server_request({ url: url, qs: url_params, cache_key: get_cache_key(`comics\\:${type}\\::name?\\:page\\::page?`, req.params) })
      .then((response) => {
        check_for_cached_response(req, res, response, helper.get_comic_listing);
      });
  };
}

//////////////////
// START ROUTES //
//////////////////

// Comic listings
router.get(ROUTES.comics.list, (req, res, next) => {
  var url = 'http://readcomiconline.to/ComicList';
  var url_params = {};

  if (!!req.params.letter) {
    if (req.params.letter.match(/^[1-9][0-9]*$/) && !req.params.page) {
      req.params.page = req.params.letter;
      req.params.letter = undefined;
    }
  }

  if (!!req.params.letter) {
    url_params.c = req.params.letter;
  }

  if (!!req.params.page) {
    url_params.page = req.params.page;
  }

  upstream.server_request({
    authData: req.authData,
    url: url,
    qs: url_params,
    cache_key: get_cache_key("comics\\:letter\\::letter?\\:page\\::page?", req.params)
  }).then((response) => {
    check_for_cached_response(req, res, response, helper.get_comic_listing);
  }).catch((error) => {
    if (error === 'UNAUTHORIZED') {
      responses.unauthorized(res);
    }
    else {
      responses.unknown(res, error);
    }
  });
});

// Search comic
router.get(ROUTES.comics.search, (req, res) => {
  var url = 'http://readcomiconline.to/AdvanceSearch';

  if (req.params.keyword.match(new RegExp(`^[012]{${GENRES.length}}$`))) {
    req.params.genres = req.params.keyword;
    req.params.keyword = '';
  }

  var body = `comicName=${req.params.keyword || ''}`;

  if (!req.params.genres)
    req.params.genres = '0'.repeat(47);

  for (var i = 0; i < req.params.genres.length; i++)
    body += `&genres=${req.params.genres[i]}`;

  body += `&status=${req.params.status || ''}`;

  request_options = {
    url: url,
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  };

  upstream.server_request(request_options)
    .then((response) => {
      get_comic_listing(response, req).
        then((result) => { res.send(result); });
    });
});

// Comic details
router.get(ROUTES.comics.detail, (req, res) => {
  var url = `http://readcomiconline.to/Comic/${req.params.name}`;

  upstream.server_request({ url: url, cache_key: get_cache_key("comics\\:detail\\::name", req.params) })
    .then((response) => {
      check_for_cached_response(req, res, response, helper.get_comic_details);
    });
});

// Issue details
router.get(ROUTES.comics.issue, (req, res) => {
  // readType = 0 -> one pages
  // readType = 1 -> all pages
  // quality = hq -> high quality
  // quality = lq -> low quality
  var url = `http://readcomiconline.to/Comic/${req.params.name}/${req.params.issue}?readType=1&quality=lq`;

  upstream.server_request({ url: url, cache_key: get_cache_key("comics\\:detail\\::name\\::issue", req.params) })
    .then((response) => {
      check_for_cached_response(req, res, response, helper.get_comic_issue);
    });
});

// Comic listings by genre
router.get(ROUTES.genres, (req, res) => {
  if (!!req.params.name) {
    handle_simple_comic_listing_request('genre')(req, res);
  }
  else {
    var data = GENRES.map((genre) => {
      var id = genre.replace(/[^a-z0-9 ]/ig, '').replace(/\s+/g, '-').toLowerCase();
      return {
        links: {
          self: upstream.make_url(`/genres/${id}`)
        },
        data: {
          type: 'genre',
          id: id,
          attributes: {
            name: genre
          }
        }
      }
    });

    res.json({ data: data });
  }
});

// Comic listings by publisher
router.get(ROUTES.publishers, handle_simple_comic_listing_request('publisher'));
// Comic listings by writer
router.get(ROUTES.writers, handle_simple_comic_listing_request('writer'));
// Comic listings by artist
router.get(ROUTES.artists, handle_simple_comic_listing_request('artist'));

router.use('/covers', express.static('cache/covers'));

module.exports = router;
