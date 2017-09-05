import jwt from 'jsonwebtoken';

const key = process.env.ENCRYPTION_KEY || "secret";

const create = (payload, callback) => {
  return jwt.sign(payload, key, undefined, callback);
}

const verify = (token, callback) => {
  return jwt.verify(token, key, undefined, callback);
}

export {
  create,
  verify
};
