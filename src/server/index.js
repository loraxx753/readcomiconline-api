// External libs
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import errorHandler from 'errorhandler';

// Our libs
import { authentication } from '../lib/authentication';

import { users } from './users';
import { comics } from './comics';
import { genres } from './genres';
import { createListRouter } from './helpers/comic_list_router';
import { session } from './helpers/session_helper';
import { ROUTES } from '../lib/constants';

const app = express();

// Third party middleware
app.use(morgan('combined'));
app.use(bodyParser.json()); // for parsing application/json
app.use(errorHandler({ showStack: true, dumpExceptions: true }));

// ROUTERS

// Authenticated paths
app.use(ROUTES.users.namespace, authentication, users);
app.use(ROUTES.comics.namespace, authentication, comics);
app.use(ROUTES.genres.namespace, authentication, genres);
app.use('/publishers', authentication, createListRouter('publisher'));
app.use('/artists', authentication, createListRouter('artist'));
app.use('/writers', authentication, createListRouter('writer'));

// Login/Logout
app.use('/', session);


// Static paths
app.use('/covers', express.static('cache/covers'));

app.listen(process.env.PORT || 8081, function() {
  console.log('Readcomiconline API listening on port 8081!');
});

export default app;
