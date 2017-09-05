const RESPONSES = {
  unauthorized: { error: 'UNAUTHORIZED', message: 'Invalid token' },
  invalidLogin: { error: 'INVALID', message: 'Invalid username or password' },
}
const unauthorized = (res) => res.status(401).json(RESPONSES.unauthorized);
const invalidLogin = (res) => res.status(401).json(RESPONSES.invalidLogin);

module.exports = { unauthorized, invalidLogin };
