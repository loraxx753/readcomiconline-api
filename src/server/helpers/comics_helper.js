import cheerio from 'cheerio';
import async from 'async';
import pathToRegexp from 'path-to-regexp';

import { ROUTES } from '../../lib/constants';
import cache from '../../lib/cache';
import responses from '../../lib/responses';
import upstream from '../../lib/upstream';

const cover_download_queue = async.queue((task, callback) => {
  upstream.download(task.url, task.filename)
    .then(callback, callback);
});

const get_cache_key = (template, data) => {
  return pathToRegexp.compile(template)(data);
};

const get_url_last_part = (url) => {
  return url.replace(/^.*?\/([^\/]+?)(\?.+)?$/, '$1').toLowerCase();
}

const get_person_data = ($data, type) => {
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
      self: upstream.make_url(`/${type}/${id}`, {}, type)
    }
  };
}

const get_linked_data = ($data, type) => {
  var id = get_url_last_part($data.attr('href'));

  return {
    type: type,
    id: id,
    attributes: {
      name: $data.text()
    },
    links: {
      self: upstream.make_url(`/${type}/${id}`, {}, type)
    }
  };
}

const get_comic_listing = (response, request) => {
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
    links.first = upstream.make_url(request.route.path, link_params);

    if (current_page_number > 2) {
      links.previous = upstream.make_url(request.route.path, Object.assign({}, link_params, { page: current_page_number - 1 }), ROUTES.comics.namespace);
    }
    else {
      links.previous = links.first;
    }
  }

  if (current_page_number < last_page_number) {
    Object.assign(links, {
      next: upstream.make_url(request.route.path, Object.assign({}, link_params, { page: current_page_number + 1 }), ROUTES.comics.namespace),
      last: upstream.make_url(request.route.path, Object.assign({}, link_params, { page: last_page_number }), ROUTES.comics.namespace)
    });
  }

  // console.log(`Rows: ${$all_rows.length}`);

  var cover_downloaders = [];
  var all_comics_with_covers = [];

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
          self: upstream.make_url(ROUTES.comics.detail, { name: comic_id }, ROUTES.comics.namespace)
        }
      };

      // Download the cover
      var cover_filename = cache.get_cached_absolute_path('covers', comic_id);

      if (cache.cached_file_exists(cover_filename)) {
        comic.links.cover = upstream.make_url(cache.get_url_from_cached_file(cache.get_first_cached_file(cover_filename)));
      }
      else {
        console.log(`[${comic_id}] Queueing: ${cover_url}`);
        cover_download_queue.push({ url: cover_url, filename: cover_filename }, (filename) => {
          if (!!filename)
            comic.links.cover = upstream.make_url(cache.get_url_from_cached_file(filename));
        });
      }

      all_comics_with_covers.push(comic);
    }
  });

  if (cover_download_queue.length() > 0) {
    return new Promise((resolve, reject) => {
      cover_download_queue.drain = () => {
        console.log('All covers downloaded, resolving promise');
        resolve({
          links: links,
          data: all_comics_with_covers
        });
      };
    });
  }
  else {
    return new Promise((resolve, reject) => {
      resolve({
        links: links,
        data: all_comics_with_covers
      });
    });
  }
};

const get_comic_details = (response, request) => {
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
        var url = upstream.make_url(ROUTES.comics.issue, { name: json_data.data.id, issue: issue_id }, ROUTES.comics.namespace);
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
    upstream.download(cover_url, cache.get_cached_absolute_path('covers', request.params.name))
      .then((filename) => {
        json_data.data.links.cover = upstream.make_url(cache.get_url_from_cached_file(filename));
        resolve(json_data);
      });
  });
  p.__name = 'Comic details';
  return p;
};

const get_comic_issue = (response, request) => {
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

const handle_simple_comic_listing_request = (type) => {
  return (req, res) => {
    var url = `http://readcomiconline.to/${type}/${req.params.name}`;
    var url_params = {};

    if (!!req.params.page) {
      url_params.page = req.params.page;
    }

    upstream.server_request({ url: url, qs: url_params, cache_key: get_cache_key(`comics\\:${type}\\::name?\\:page\\::page?`, req.params) })
      .then((response) => {
        check_for_cached_response(req, res, response, get_comic_listing);
      }).catch((error) => {
        if (error === 'UNAUTHORIZED') {
          responses.unauthorized(res);
        }
        else {
          responses.unknown(res, error);
        }
      });
  };
}

const check_for_cached_response = (request_stream, response_stream, response, callback) => {
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

export default {
  get_person_data,
  get_linked_data,
  get_comic_listing,
  get_comic_details,
  get_comic_issue,
  handle_simple_comic_listing_request,
  check_for_cached_response,
  get_cache_key
};
