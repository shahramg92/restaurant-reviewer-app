// import express
const express = require('express');
// set up express server
const app = express();
// require the bod-parser module
const bodyParser = require('body-parser');

const promise = require('bluebird');
const pgp = require('pg-promise')({promiseLib: promise});
const db = pgp({database: 'todo'});

// Handlebars setup
app.set('view engine', 'hbs');

// Set Static Path
app.use('/static', express.static('public'));

// Body Parser Middleware
app.use(body_parser.urlencoded({extended: false}));


app.get('/', function (request, response) {
  response.render('search_form.hbs');
});

app.get('/search', function(request, response) {
  let term = request.query.searchTerm;
  console.log('Term', term);
  db.any(`
    SELECT * FROM RESTAURANT
    WHERE RESTAURANT.NAME ILIKE '%$(term)'
    `)
    .then(function(resultsArray {
      console.log('results', resultsArray);
      response.render('search_results.hbs' {
        results: resultsArray
      });
    }));
});







app.listen(1337, function(request, response){
  console.log('Access granted to port 1337')
});
