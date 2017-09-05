// const BASE_URL = 'http://pmr.knifeinthesocket.com:8081';
const BASE_URL = 'http://api.comics.knifeinthesocket.com';
// const BASE_URL = 'http://localhost:8081';
// const BASE_URL = 'http://192.168.9.71:8081'; // Cloudware
// const BASE_URL = 'http://192.168.1.16:8081'; // Home

const ROUTES = {
  root: '/',
  users: {
    login: '/login',
    logout: '/logout'
  },
  comics: {
    list: '/:letter(0|[a-z])?/:page(\\d+)?',
    search: '/search/:keyword/:genres([012]{47})?/:status(ongoing|completed)?',
    detail: '/:name',
    issue: '/:name/:issue'
  },
  genres: '/genres/:name?/:page?',
  publishers: '/publishers/:name/:page?',
  writers: '/writers/:name/:page?',
  artists: '/artists/:name/:page?'
};


export {
  BASE_URL,
  ROUTES
};
