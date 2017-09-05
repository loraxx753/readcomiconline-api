import ROUTES from './routes';

const CACHE_ENABLED = false;

// const BASE_URL = 'http://pmr.knifeinthesocket.com:8081';
// const BASE_URL = 'http://api.comics.knifeinthesocket.com';
const BASE_URL = 'http://localhost:8081';
// const BASE_URL = 'http://192.168.1.16:8081'; // Home

const REQUEST_HEADERS = {
  "Host": 'readcomiconline.to',
  "Upgrade-Insecure-Requests": '1',
  "User-Agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36',
  "Accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  "Accept-Encoding": 'gzip, deflate, sdch',
  "Accept-Language": 'en-GB,en;q=0.8'
};

const GENRES = [ 'Action', 'Adventure', 'Anthology', 'Anthropomorphic', 'Biography', 'Children', 'Comedy', 'Crime'
  , 'Drama', 'Family', 'Fantasy', 'Fighting', 'Graphic Novels', 'Historical', 'Horror', 'Leading Ladies', 'LGBTQ'
  , 'Literature', 'Manga', 'Martial Arts', 'Mature', 'Military', 'Movies & TV', 'Mystery', 'Mythology', 'Personal'
  , 'Political', 'Post-Apocalyptic', 'Psychological', 'Pulp', 'Religious', 'Robots', 'Romance', 'School Life'
  , 'Sci-Fi', 'Slice of Life', 'Sport', 'Spy', 'Superhero', 'Supernatural', 'Suspense', 'Thriller', 'Vampires'
  , 'Video Games', 'War', 'Western', 'Zombies' ];

export {
  CACHE_ENABLED,
  BASE_URL,
  REQUEST_HEADERS,
  ROUTES,
  GENRES
};
