const express = require('express');
const bodyParser = require('body-parser');
const promise = require('bluebird');
const pgp = require('pg-promise')({promiseLib: promise});
const db = pgp(process.env.DATABASE_URL || {database: 'restaurant2'});
const session = require('express-session');
const morgan = require('morgan');

// password
var pbkdf2 = require('pbkdf2');
var crypto = require('crypto');
var salt = crypto.randomBytes(20).toString('hex');
var password = 'some-password';
var key = pbkdf2.pbkdf2Sync(
  password, salt, 36000, 256, 'sha256'
);
var hash = key.toString('hex');

const app = express();
app.set('view engine', 'hbs');
app.use(bodyParser.urlencoded({extended: false}));
app.use('/static', express.static('public'));
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SECRET_KEY || 'dev',
  resave: true,
  saveUninitialized: false,
  cookie: {maxAge: 60000}
}));


app.get('/', function (request, response) {
  response.render('search_form.hbs');
});

app.get('/search', function(request, response, next) {
  let term = request.query.searchTerm;
  console.log('Term:', term);
  db.any(`
    SELECT * FROM restaurant
    WHERE restaurant.name ILIKE '%$1#%'
    `, term)
    .then(function(resultsArray) {
      console.log('results', resultsArray);
      response.render('search_results.hbs', {
        results: resultsArray
      });
    })
    .catch(next);
});

app.get('/restaurant/new', function(request, response) {
  response.render('new_restaurant.hbs')
});


app.get('/restaurant/:id', function(request, response, next) {
  let id = request.params.id;
  db.any(`
    SELECT
      restaurant.name as restaurant_name,
      restaurant.address,
      restaurant.category,
      restaurant.id as restaurant_id,
      reviewer.name as reviewer_name,
      review.title,
      review.stars,
      review.review
    FROM restaurant
    LEFT OUTER JOIN
      review on review.restaurant_id = restaurant.id
    LEFT OUTER JOIN
      reviewer on review.reviewer_id = reviewer.id
    where restaurant.id = ${id}
  `)
    .then(function(review) {
      console.log('review', review[0]);
      response.render('restaurant.hbs', {
        restaurant: review[0],
        review: review,
        hasReviews: review[0].reviewer_name
      });
    })
    .catch(next);
});

app.post('/restaurant/submit_new_restaurant', function(request, response, next) {
  var name = request.body.name;
  var address = request.body.address;
  var category = request.body.category;
  var query = 'INSERT INTO restaurant VALUES (DEFAULT, ${name}, ${address}, ${category}) RETURNING id';
  db.one(query, {name: name, address: address, category: category})
    .then(function(results) {
      console.log("Restaurant ID:", results.id)
      response.redirect('/restaurant/' + results.id)
    })
  .catch(next);
});

app.post('/submit_review/:restaurant_id', function(req, resp, next) {
  var restaurant_id = req.params.restaurant_id;
  var stars = req.body.stars;
  var title = req.body.title;
  var review = req.body.review;
  var columns = {
    stars: stars,
    title: title,
    review: review,
    restaurant_id: restaurant_id
  }
  console.log('columns are ', columns);
  var query = 'INSERT INTO review VALUES\
    (DEFAULT, NULL, ${stars}, ${title}, ${review}, ${restaurant_id}) RETURNING id';
  db.any(query, columns)
    .then(function(results) {
      console.log(results)
      resp.redirect('/restaurant/' + restaurant_id);
    })
    .catch((err)=>{console.error(err); next()});
});


// app.listen(1337, function(request, response){
//   console.log('Access granted to port 1337')
// });

var PORT = process.env.PORT || 8000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);
});
