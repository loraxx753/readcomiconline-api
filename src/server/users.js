const router         = require('express').Router();
const upstream = require('../lib/upstream');
import { createJWToken } from '../lib/authentication';

const ROUTES = {
  login: '/login',
  logout: '/logout'
}

router.post(ROUTES.login, (req, res) => {
  console.log('req', req);

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

module.exports = router;
