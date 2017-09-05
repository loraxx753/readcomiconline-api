const cheerio = require('cheerio');
const file_cookie_store = require("tough-cookie-file-store");
const requestLib = require('request');
const fs            = require('fs');
const path          = require('path');

const get_cookie_filename = () => {
  var full_path, stat;

  // Ensure that the cookies file exists
  try {
    full_path = path.resolve('cookies.json');
    stat = fs.statSync(full_path);
  }
  catch(err) {
    var fd = fs.openSync(full_path, 'w');
    fs.closeSync(fs.openSync(full_path, 'w'));
  }

  return full_path;
};
const cookieJar = new file_cookie_store(get_cookie_filename());
const request = requestLib.defaults({
  jar: requestLib.jar(cookieJar)
});

const pass_challenge = (url, html) => {
  return new Promise((resolve, reject) => {
    var regex = /setTimeout\(((?:.|\n)*?), 4000/igm;
    var challenge_function;
    var challenge_answer;

    challenge_function = regex.exec(html)[1];
    challenge_function = challenge_function.replace(/;/g, ";\n");

    challenge_function = challenge_function.replace('a.value =', 'return').replace('\/\//', '\\/\\//');

    var lines = challenge_function.split("\n");

    lines = lines.filter(function(line) {
      return !!line.match(/=\{/) || !!line.match(/[-+*\/]=/) || !!line.match(/parseInt/);
    });

    var protocol_domain = url.match(/(https?:\/\/[^\/]+)/)[0];

    lines.splice(-1, 0, "t = '" + protocol_domain.replace(/https?:\/\//, '') + "';");

    eval(" challenge_answer = (function() {\n" + lines.join("\n") + " '; 121' })();");

    var $ = cheerio.load(html);


    // <form id="challenge-form" action="/cdn-cgi/l/chk_jschl" method="get">
    //   <input type="hidden" name="jschl_vc" value="f36b73064deb84dfb4e09bc271af393d"/>
    //   <input type="hidden" name="pass" value="1473499531.4-TJDo+u8spw"/>
    //   <input type="hidden" id="jschl-answer" name="jschl_answer"/>
    // </form>
    var $challenge_form = $('#challenge-form');
    var new_url = protocol_domain + $challenge_form.attr('action');

    new_url += '?' + $challenge_form.find('input').toArray().map(function(item, index) {
      const $item = $(item);
      return $item.attr('name') + '=' + ($item.attr('value') || challenge_answer);
    }).join('&');

    var request_options = {
      url: new_url,
      headers: {
        "Host": 'readcomiconline.to',
        "Upgrade-Insecure-Requests": '1',
        "User-Agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36',
        "Accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        "Referer": url,
        "Accept-Encoding": 'gzip, deflate, sdch',
        "Accept-Language": 'en-GB,en;q=0.8'
      },
      gzip: true
    };

    // Wait 4 seconds to simulate the sleep on the web page
    setTimeout(() => {
      resolve(request_options);
    }, 4000);
  });
};

export { pass_challenge };
