// import express
const express = require('express');
// set up express server
const app = express();
// require the bod-parser module
const bodyParser = require('body-parser');

const promise = require('bluebird');
const pgp = require('pg-promise')({promiseLib: promise});
const db = pgp({database: 'restaurant2'});

// Handlebars setup
app.set('view engine', 'hbs');

// Set Static Path
app.use('/static', express.static('public'));

// Body Parser Middleware
app.use(bodyParser.urlencoded({extended: false}));


app.get('/', function (request, response) {
  response.render('search_form.hbs');
});

app.get('/search', function(request, response, next) {
  let term = request.query.searchTerm;
  console.log('Term:', term);
  db.any(`
    SELECT * FROM restaurant
    WHERE restaurant.name ILIKE '%$(term)%'
    `)
    .then(function(resultsArray) {
      console.log('results', resultsArray);
      response.render('search_results.hbs', {
        results: resultsArray
      });
    })
    .catch(next);
});

app.get('/restaurant/:id', function( request, response, next) {
  let id = request.params.id;
  








})





app.listen(1337, function(request, response){
  console.log('Access granted to port 1337')
});
