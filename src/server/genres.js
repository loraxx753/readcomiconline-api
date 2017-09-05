var express         = require('express');
var cheerio         = require('cheerio');
var genres          = express.Router();
var stringify       = require('node-stringify');
var pathToRegexp    = require('path-to-regexp');
var async           = require('async');

import cache from '../lib/cache';
import responses from '../lib/responses';
import upstream from '../lib/upstream';
import { ROUTES, GENRES } from '../lib/constants';
import comicHelper from './helpers/comics_helper';

// Comic listings by genre
genres.get(ROUTES.genres, (req, res) => {
  if (!!req.params.name) {
    comicHelper.handle_simple_comic_listing_request('genre')(req, res);
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
//
// // Comic listings by publisher
// router.get(ROUTES.publishers, handle_simple_comic_listing_request('publisher'));
// // Comic listings by writer
// router.get(ROUTES.writers, handle_simple_comic_listing_request('writer'));
// // Comic listings by artist
// router.get(ROUTES.artists, handle_simple_comic_listing_request('artist'));
//
export { genres };
