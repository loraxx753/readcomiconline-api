var express = require('express');
var app     = express();
var comics  = require('./comics');
var morgan = require('morgan');
var errorHandler = require('errorhandler')

app.use(morgan('combined'));

app.use('/', comics);

app.use(errorHandler({showStack: true, dumpExceptions: true}));

app.listen(process.env.PORT || 8081, function() {
  console.log('Readcomiconline API listening on port 8081!');
});


module.exports = app;