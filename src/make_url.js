// var base_url = 'http://pmr.knifeinthesocket.com:8081';
var base_url = 'http://api.comics.knifeinthesocket.com';
// var base_url = 'http://localhost:8081';
// var base_url = 'http://192.168.9.71:8081'; // Cloudware
// var base_url = 'http://192.168.1.16:8081'; // Home

var pathToRegexp = require('path-to-regexp');

module.exports = (url, params) => {
  var actual_url = pathToRegexp.compile(url)(params);

  return `${base_url}${actual_url[0] == '/' ? '' : '/'}${actual_url}`.toLowerCase();
};