var express         = require('express');
var cheerio         = require('cheerio');
var app             = express();
var server_request  = require('../make_request');
var make_url        = require('../make_url');
var router          = express.Router();
var stringify       = require('node-stringify');
var pathToRegexp    = require('path-to-regexp');
var cache           = require('../cache');

const ROUTES = {
  root: '/',
  comics: {
    list: '/comics/:letter(0|[a-z])?/:page(\\d+)?',
    search: '/comics/search/:keyword',
  },
  comic: {
    detail: '/comic/:name',
    issue: '/comic/:name/:issue'
  },
  genres: '/genres/:name?/:page?',
  publishers: '/publishers/:name/:page?',
  writers: '/writers/:name/:page?',
  artists: '/artists/:name/:page?'
};

var get_url_last_part = (url) => {
  return url.replace(/^.*?\/([^\/]+?)(\?.+)?$/, '$1').toLowerCase();
}

var get_person_data = ($data, type) => {
  var id = get_url_last_part($data.attr('href'));
  var name = $data.text().split(' ');

  return {
    type: type,
    id: id,
    attributes: {
      first_name: name[0],
      last_name: name[name.length - 1]
    },
    links: {
      self: make_url(`/${type}/${id}`)
    }
  };
}

var get_linked_data = ($data, type) => {
  var id = get_url_last_part($data.attr('href'));

  return {
    type: type,
    id: id,
    attributes: {
      name: $data.text()
    },
    links: {
      self: make_url(`/${type}/${id}`)
    }
  };
}

var get_cache_key = (template, data) => {
  return pathToRegexp.compile(template)(data);
};

var get_comic_listing = (response, request) => {
  var $ = cheerio.load(response.body);
  var params = request.params;
  var all_comics = [];
  var $all_rows = $('table.listing').find('tr');
  var $pager = $('.pagination').find('.pager');
  var letter_link_part = !!params.letter ? `/${params.letter}` : '';
  var current_page_number = Number(params.page || '1');
  var last_page_number = $pager.find('li:last-child');
  last_page_number = Number(last_page_number.hasClass('current') ? last_page_number.text() : last_page_number.find('a').attr('page'));

  var links = {};

  var link_params = Object.assign({}, params);
  delete link_params.page;

  if (current_page_number > 1) {
    links.first = make_url(request.route.path, link_params);

    if (current_page_number > 2) {
      links.previous = make_url(request.route.path, Object.assign({}, link_params, { page: current_page_number - 1 }));
    }
    else {
      links.previous = links.first;
    }
  }

  if (current_page_number < last_page_number) {
    Object.assign(links, {
      next: make_url(request.route.path, Object.assign({}, link_params, { page: current_page_number + 1 })),
      last: make_url(request.route.path, Object.assign({}, link_params, { page: last_page_number }))
    });
  }

  // console.log(`Rows: ${$all_rows.length}`);

  var cover_downloaders = [];

  $all_rows.each((index, item) => {
    var $item = $(item);

    if ($item.find('td a').length > 0) {
      var $name_cell = $item.find('td:first-child');
      var $url = $name_cell.find('a');
      var is_finished = $item.find('td:last-child a').length == 0;
      var comic_id = $url.attr('href').replace(/^\/Comic\//i, '').toLowerCase();
      var cover_url = $name_cell.attr('title').match(/img\s*.*?\s*src="(.*?)"/)[1];

      var comic = {
        type: 'comics',
        id: comic_id,
        attributes: {
          title: $url.text().trim(),
          finished: is_finished
        },
        links: {
          self: make_url(ROUTES.comic.detail, { name: comic_id })
        }
      };

      // Download the cover
      cover_downloader = server_request.download(cover_url, cache.get_cached_absolute_path('covers', comic_id))
        .then((filename) => {
          comic.links.cover = make_url(cache.get_url_from_cached_file(filename));
          return comic;
        });

      cover_downloaders.push(cover_downloader);
    }
  });

  return Promise.all(cover_downloaders).then((all_comics_with_covers) => {
    return {
      links: links,
      data: all_comics_with_covers
    };
  });
};

var get_comic_details = (response, request) => {
  var p = new Promise((resolve, reject) => {
    var $ = cheerio.load(response.body);
    var $data = $('#leftside > .bigBarContainer:first-child > .barContent');
    var cover_url = $('#rightside > .rightBox:first-child > .barContent img').attr('src');

    var json_data = {
      data: {
        type: 'comics',
        id: request.params.name,
        attributes: {
          title: $data.find('.bigChar').text().trim()
        },
        relationships: {},
        links: {
        }
      },
      included: [],
      links: []
    };

    $data.find('p').each((index, item) => {
      var $item = $(item);
      var info_name = $item.find('.info:first-child').text().replace(/:/, '');

      switch(info_name) {
        case 'Genres':
          $item.find('a').each((_, genre) => {
            var genre_data = get_linked_data($(genre), 'genres');

            json_data.included.push(genre_data);

            if (!json_data.data.relationships.genres) {
              json_data.data.relationships.genres = [];
            }

            json_data.data.relationships.genres.push({
              id: genre_data.id,
              type: genre_data.type
            });
          });

          break;

        case 'Publisher':
          var publisher_data = get_linked_data($item.find('a'), 'publishers');

          json_data.included.push(publisher_data);

          json_data.data.relationships.publisher = {
            id: publisher_data.id,
            type: publisher_data.type
          };

          break;

        case 'Writer':
          var writer_data = get_person_data($item.find('a'), 'writers');

          json_data.included.push(writer_data);
          json_data.data.relationships.writer = {
            id: writer_data.id,
            type: writer_data.type
          };

          break;

        case 'Artist':
          var artist_data = get_person_data($item.find('a'), 'artists');

          json_data.included.push(artist_data);
          json_data.data.relationships.artist = {
            id: artist_data.id,
            type: artist_data.type
          };

          break;

        case 'Publication date':
          json_data.data.attributes.publication_date = $item.text().match(/publication date:\s+(.+)/i)[1].trim();
          break;

        case 'Status':
          json_data.data.attributes.status = $item.text().match(/status:\s+(.+?)\s+/i)[1].trim();
          break;

        case 'Summary':
          json_data.data.attributes.summary = $item.next().text().trim();
          break;
      }
    });

    $('.listing').find('tr').each((index, item) => {
      var $item = $(item);

      if ($item.find('a').length > 0) {
        var title = $item.find('a').text().trim();
        var issue_id = get_url_last_part($item.find('a').attr('href'));
        var url = make_url(ROUTES.comic.issue, { name: json_data.data.id, issue: issue_id });
        var release_day = $item.find('td:last-child').text().trim();

        var issue = {
          id: `${json_data.data.id}-${issue_id}`,
          type: 'issues',
          attributes: {
            title: title,
            release_day: release_day
          },
          links: {
            self: url
          }
        };

        var match = title.match(/issue #(\d+)/i);

        if (!!match) {
          issue.attributes.number = Number(match[1]);
        }

        json_data.included.push(issue);

        if (!json_data.data.relationships.issues) {
          json_data.data.relationships.issues = [];
        }

        json_data.data.relationships.issues.push({
          id: issue.id,
          type: issue.type
        });
      }
    });

    // Download the cover
    server_request.download(cover_url, cache.get_cached_absolute_path('covers', request.params.name))
      .then((filename) => {
        json_data.data.links.cover = make_url(cache.get_url_from_cached_file(filename));
        resolve(json_data);
      });
  });
  p.__name = 'Comic details';
  return p;
};

var get_comic_issue = (response, request) => {
  var json_data = {
    data: {
      type: 'issues',
      id: `${request.params.name}-${request.params.issue}`,
      attributes: {
        pages: []
      }
    }
  };

  var lines = response.body.split("\n");

  for (var line of lines) {
    var match = line.match(/lstImages\.push\(["'](.*?)["']\);/i);

    if (!!match) {
      json_data.data.attributes.pages.push(match[1]);
    }
  };

  var p = Promise.resolve(json_data);
  p.__name = 'Comic issue';
  return p;
};

var check_for_cached_response = (request_stream, response_stream, response, callback) => {
  if (response.from_cache) {
    response_stream.json(response.data);
  }
  else {
    callback(response, request_stream)
      .then((result) => {
        response.result = result;
        response_stream.json(response.result);
      })
      .catch((reason) => {
        console.log(reason);
      });
  }
};

var handle_simple_comic_listing_request = (type) => {
  return (req, res) => {
    var url = `http://readcomiconline.to/${type}/${req.params.name}`;
    var url_params = {};

    if (!!req.params.page) {
      url_params.page = req.params.page;
    }

    server_request.make_request({ url: url, qs: url_params, cache_key: get_cache_key(`comics\\:${type}\\::name?\\:page\\::page?`, req.params) })
      .then((response) => {
        check_for_cached_response(req, res, response, get_comic_listing);
      });
  };
}

//////////////////
// START ROUTES //
//////////////////

router.get(ROUTES.root, (req, res) => {
  server_request.make_request({ url: 'http://readcomiconline.to' })
    .then((response) => {
      // res.send('output');
      res.send(response.body);
    });
});

// Comic listings
router.get(ROUTES.comics.list, (req, res, next) => {
  var url = 'http://readcomiconline.to/ComicList';
  var url_params = {};

  if (!!req.params.letter) {
    if (req.params.letter.match(/^[1-9][0-9]*$/) && !req.params.page) {
      req.params.page = req.params.letter;
      req.params.letter = undefined;
    }
  }

  if (!!req.params.letter) {
    url_params.c = req.params.letter;
  }

  if (!!req.params.page) {
    url_params.page = req.params.page;
  }

  server_request.make_request({ url: url, qs: url_params, cache_key: get_cache_key("comics\\:letter\\::letter?\\:page\\::page?", req.params) })
    .then((response) => {
      check_for_cached_response(req, res, response, get_comic_listing);
    });
});

// Search comic
router.get(ROUTES.comics.search, (req, res) => {
  var url = 'http://readcomiconline.to/Search/Comic';

  request_options = {
    url: url,
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `keyword=${req.params.keyword}`
  };

  server_request.make_request(request_options)
    .then((response) => {
      get_comic_listing(response, req).
        then((result) => { res.send(result); });
    });
});

// Comic details
router.get(ROUTES.comic.detail, (req, res) => {
  var url = `http://readcomiconline.to/Comic/${req.params.name}`;

  server_request.make_request({ url: url, cache_key: get_cache_key("comics\\:detail\\::name", req.params) })
    .then((response) => {
      check_for_cached_response(req, res, response, get_comic_details);
    });
});

// Issue details
router.get(ROUTES.comic.issue, (req, res) => {
  // readType = 0 -> one pages
  // readType = 1 -> all pages
  // quality = hq -> high quality
  // quality = lq -> low quality
  var url = `http://readcomiconline.to/Comic/${req.params.name}/${req.params.issue}?readType=1&quality=lq`;

  server_request.make_request({ url: url, cache_key: get_cache_key("comics\\:detail\\::name\\::issue", req.params) })
    .then((response) => {
      check_for_cached_response(req, res, response, get_comic_issue);
    });
});

// Comic listings by genre
router.get(ROUTES.genres, (req, res) => {
  if (!!req.params.name) {
    handle_simple_comic_listing_request('genre')(req, res);
  }
  else {
    var genres = [ 'Action', 'Adventure', 'Anthology', 'Anthropomorphic', 'Biography', 'Children', 'Comedy', 'Crime'
      , 'Drama', 'Family', 'Fantasy', 'Fighting', 'Graphic Novels', 'Historical', 'Horror', 'Leading Ladies', 'LGBTQ'
      , 'Literature', 'Manga', 'Martial Arts', 'Mature', 'Military', 'Movies & TV', 'Mystery', 'Mythology', 'Personal'
      , 'Political', 'Post-Apocalyptic', 'Psychological', 'Pulp', 'Religious', 'Robots', 'Romance', 'School Life'
      , 'Sci-Fi', 'Slice of Life', 'Spy', 'Superhero', 'Supernatural', 'Suspense', 'Thriller', 'Vampires'
      , 'Video Games', 'War', 'Western', 'Zombies' ];

    var data = genres.map((genre) => {
      var id = genre.replace(/[^a-z0-9 ]/ig, '').replace(/\s+/g, '-').toLowerCase();
      return {
        links: {
          self: make_url(`/genres/${id}`)
        },
        data: {
          type: 'genre',
          id: id,
          attributes: {
            name: genre
          }
        }
      }
    });

    res.json(data);
  }
});

// Comic listings by publisher
router.get(ROUTES.publishers, handle_simple_comic_listing_request('publisher'));
// Comic listings by writer
router.get(ROUTES.writers, handle_simple_comic_listing_request('writer'));
// Comic listings by artist
router.get(ROUTES.artists, handle_simple_comic_listing_request('artist'));

router.use('/covers', express.static('cache/covers'));

module.exports = router;