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
import { ROUTES } from '../lib/constants';
import upstream from '../lib/upstream';

const app = express();

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

app.post(ROUTES.login, (req, res) => {
  const unauthorized = () => {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid username or password'
    });
  };

  if (!!req.body.username && !!req.body.password) {
    const requestParams = {
      formData: {
        username: req.body.username,
        password: req.body.password,
        redirect: ''
      },
      url: 'http://readcomiconline.to/Login',
      method: 'POST',
      headers: {
        'Referer': 'http://readcomiconline.to/Login',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    upstream.server_request(requestParams)
      .then((data) => {
        const cookiesSet = data.response.headers['set-cookie'] || [];
        const { username, password, 'ASP.NET_SessionId': sessionId } = data.cookies;

        if (!!username && !!password && !!sessionId) {
          const jwtToken = createJWToken({ username, password, sessionId });
          res.json({ jwt: jwtToken });
        }
        else {
          unauthorized();
        }
      });
    }
    else {
      unauthorized();
    }
});

// Static paths
app.use('/covers', express.static('cache/covers'));

app.listen(process.env.PORT || 8081, function() {
  console.log('Readcomiconline API listening on port 8081!');
});

export default app;
