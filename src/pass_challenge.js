var cheerio = require('cheerio');

module.exports = function(url, html) {
  console.log("------ html ------");
  console.log(html);
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");
  console.log("------ html ------");


  var regex = /setTimeout\(((?:.|\n)*?), 4000/igm;
  var challenge_function;
  var challenge_answer;

  challenge_function = regex.exec(html)[1].replace(/;/g, ";\n");

  // console.log(html);
  console.log("------ challenge_function ------");
  console.log(challenge_function);
  console.log("------ challenge_function ------");

  challenge_function = challenge_function.replace('a.value =', 'return').replace('\/\//', '\\/\\//');

  var lines = challenge_function.split("\n");

  lines = lines.filter(function(line) {
    return !!line.match(/=\{/) || !!line.match(/[-+*\/]=/) || !!line.match(/parseInt/);
  });

  var protocol_domain = url.match(/(https?:\/\/[^\/]+)/)[0];

  lines.splice(-1, 0, "t = '" + protocol_domain.replace(/https?:\/\//, '') + "';");


  console.log(lines);
  // console.log(challenge_function);

  console.log(" challenge_answer = (function() {\n" + lines.join("\n") + " '; 121'\n})();");
  eval(" challenge_answer = (function() {\n" + lines.join("\n") + " '; 121' })();");

  // console.log(challenge_function);
  console.log('challenge_answer', challenge_answer);

  var $ = cheerio.load(html);


  // <form id="challenge-form" action="/cdn-cgi/l/chk_jschl" method="get">
  //   <input type="hidden" name="jschl_vc" value="f36b73064deb84dfb4e09bc271af393d"/>
  //   <input type="hidden" name="pass" value="1473499531.4-TJDo+u8spw"/>
  //   <input type="hidden" id="jschl-answer" name="jschl_answer"/>
  // </form>
  var $challenge_form = $('#challenge-form');
  var new_url = protocol_domain + $challenge_form.attr('action');

  new_url += '?' + $challenge_form.find('input').toArray().map(function(item, index) {
    $item = $(item);
    return $item.attr('name') + '=' + ($item.attr('value') || challenge_answer);
  }).join('&');

  return new_url;
};