import { BASE_URL } from '../constants';
import pathToRegexp from 'path-to-regexp';

const make_url = (url, params, namespace = '') => {
  const actual_url = `/${pathToRegexp.compile(url)(params)}`;

  return `${BASE_URL}${namespace}${actual_url}`.toLowerCase().replace(/\/+/g, '/');
};

export { make_url };
