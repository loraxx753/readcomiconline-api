import { BASE_URL } from '../constants';
import pathToRegexp from 'path-to-regexp';

const make_url = (url, params) => {
  var actual_url = pathToRegexp.compile(url)(params);

  return `${BASE_URL}${actual_url[0] == '/' ? '' : '/'}${actual_url}`.toLowerCase();
};

export { make_url };
