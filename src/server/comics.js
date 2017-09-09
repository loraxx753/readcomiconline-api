var express         = require('express');
var cheerio         = require('cheerio');
var comics          = express.Router();
var stringify       = require('node-stringify');
var async           = require('async');

import cache from '../lib/cache';
import responses from '../lib/responses';
import upstream from '../lib/upstream';
import { ROUTES, GENRES } from '../lib/constants';
import helper from './helpers/comics_helper';

//////////////////
// START ROUTES //
//////////////////

// Comic listings
// curl -H 'Accept: application/json'
//      -H 'Content-Type: application/json'
//      -H 'Authorization: Bearer <JWToken>'
//      "http://localhost:8081/comics/2"
comics.get(ROUTES.comics.list, (req, res, next) => {
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
    cache_key: helper.get_cache_key("comics\\:letter\\::letter?\\:page\\::page?", req.params)
  }).then((response) => {
    helper.check_for_cached_response(req, res, response, helper.get_comic_listing);
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
comics.get(ROUTES.comics.search, (req, res) => {
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
// curl -H 'Accept: application/json'
//      -H 'Content-Type: application/json'
//      -H 'Authorization: Bearer <JWToken>'
//      "http://localhost:8081/comics/a-x"
comics.get(ROUTES.comics.detail, (req, res) => {
  var url = `http://readcomiconline.to/Comic/${req.params.name}`;

  upstream.server_request({ url: url, cache_key: helper.get_cache_key("comics\\:detail\\::name", req.params) })
    .then((response) => {
      helper.check_for_cached_response(req, res, response, helper.get_comic_details);
    });
});

// Issue details
comics.get(ROUTES.comics.issue, (req, res) => {
  // readType = 0 -> one pages
  // readType = 1 -> all pages
  // quality = hq -> high quality
  // quality = lq -> low quality
  var url = `http://readcomiconline.to/Comic/${req.params.name}/${req.params.issue}?readType=1&quality=lq`;

  upstream.server_request({ url: url, cache_key: helper.get_cache_key("comics\\:detail\\::name\\::issue", req.params) })
    .then((response) => {
      helper.check_for_cached_response(req, res, response, helper.get_comic_issue);
    });
});

// Favorite management
comics.put(ROUTES.comics.favorite, (req, res) => {
  var url = `http://readcomiconline.to/Bookmark/${req.params.name}/${req.params.issue}?readType=1&quality=lq`;

  helper.get_comic_numeric_id(req.params.name)
    .then(helper.add_favorite_comic)
    .then(() => responses.emptySuccess(res))
    .catch((error) => {
      if (error === 'UNAUTHORIZED') {
        responses.unauthorized(res);
      }
      else {
        responses.unknown(res, error);
      }
    });
});

comics.delete(ROUTES.comics.favorite, (req, res) => {
  var url = `http://readcomiconline.to/Bookmark/${req.params.name}/${req.params.issue}?readType=1&quality=lq`;

  helper.get_comic_numeric_id(req.params.name)
    .then(helper.remove_favorite_comic)
    .then(() => responses.emptySuccess(res))
    .catch((error) => {
      if (error === 'UNAUTHORIZED') {
        responses.unauthorized(res);
      }
      else {
        responses.unknown(res, error);
      }
    });
});

export { comics };
