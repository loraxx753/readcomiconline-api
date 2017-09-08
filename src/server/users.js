import express from 'express';

import upstream from '../lib/upstream';
import { createJWToken } from '../lib/authentication';
import { ROUTES } from '../lib/constants';
import comicHelper from './helpers/comics_helper';

const users = express.Router();

users.get(ROUTES.users.favorites, (req, res) => {
  const requestParams = {
    authData: req.authData,
    url: 'http://readcomiconline.to/BookmarkList',
  };

  upstream.server_request(requestParams)
    .then((response) => {
      comicHelper.check_for_cached_response(req, res, response, comicHelper.get_comic_listing);
    });
});

export { users };
