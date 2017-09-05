import express from 'express';

import { ROUTES } from '../../lib/constants';
import comicHelper from './comics_helper';

// // Comic listings by writer
// router.get(ROUTES.writers, handle_simple_comic_listing_request('writer'));
// // Comic listings by artist
// router.get(ROUTES.artists, handle_simple_comic_listing_request('artist'));
//

const createListRouter = (type) => {
  const router = express.Router();

  router.get(ROUTES.list.list, comicHelper.handle_simple_comic_listing_request(type));

  return router;
}

export { createListRouter };
