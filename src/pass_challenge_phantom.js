var phantom = require('phantom');

module.exports = function(url) {
  console.log('Attempting challeng on', url);

  return new Promise((resolve, reject) => {
    var attempts = 0;

    phantom.create()
      .then(function(instance) {
        phInstance = instance;
        request_object = {
          ready: false,
          challenge_data: {
            url: '',
            headers: {}
          }
        };

        return instance.createPage();
      })
      .then(function(page) {
        sitepage = page;
        console.log('phantom opening url:', url);
        return page.open(url);
      })
      .then(function(status) {
        var handleChallengeRequest = function() {

          sitepage.on('onResourceRequested', function (requestData, networkRequest) {
            if (requestData.url.match(/chk_jschl/)) {
              console.log('onResourceRequested', requestData.url);

              request_object.challenge_data.url = requestData.url;

              requestData.headers.forEach(function(header) {
                // console.log('header', header.name, ' = ', header.value);
                request_object.challenge_data.headers[header.name] = header.value;
              });

              request_object.ready = true;

              sitepage.off('onResourceRequested');
            }
            else {
              console.log('Request ignored:', requestData.url);
            }

          });
        };

        var afterChallengeRequest = function() {
          console.log('request_object.ready', request_object.ready);

          if (request_object.ready) {
            phInstance.exit();

            console.log('request_object.challenge_data');
            console.log(request_object.challenge_data);
            console.log('checking challenge_data.ready', request_object.challenge_data.ready);
            console.log('checking challenge_data.url', request_object.challenge_data.url);

            resolve(request_object.challenge_data);
          } else {
            if (attempts < 10) {
              attempts++;
              setTimeout(afterChallengeRequest, 1000);
            }
            else {
              throw 'Maximum number of attempts reached';
            }
          }
        };

        handleChallengeRequest();
        afterChallengeRequest();
      })
      .catch(function(error) {
        console.log(error);
        // debugger;
        phInstance.exit();

        reject(error);
      });
  });
};