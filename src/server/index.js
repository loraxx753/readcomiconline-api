var express = require('express');
var app     = express();
var comics  = require('./comics');
const users  = require('./users');
const bodyParser = require('body-parser');
import { authentication } from '../lib/authentication';
var morgan = require('morgan');
var errorHandler = require('errorhandler')

app.use(morgan('combined'));

app.use(bodyParser.json()); // for parsing application/json
// app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// app.use('/', comics);
app.use('/comics', authentication);
app.use('/comics', comics);
app.use('/users', users);

app.use(errorHandler({showStack: true, dumpExceptions: true}));

app.listen(process.env.PORT || 8081, function() {
  console.log('Readcomiconline API listening on port 8081!');
});


module.exports = app;
