import { unauthorized } from '../responses/unauthorized';
import expressAuthentication from 'express-authentication';
import { verify as verifyJWToken } from './json_web_token';

const auth = expressAuthentication();

const authentication = (req, res, next) => {
  try {
    const data = req.get('Authorization');
    const token = data.match(/^Bearer (.*)$/)[1];
    const payload = verifyJWToken(token);

    req.authData = payload;

    next();
  }
  catch(e) {
    return unauthorized(res);
  }
};

export { authentication };
