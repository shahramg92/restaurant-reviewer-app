const express = require('express');
const bodyParser = require('body-parser');
const promise = require('bluebird');
const pgp = require('pg-promise')({promiseLib: promise});
const db = pgp(process.env.DATABASE_URL || {database: 'restaurant2'});
const session = require('express-session');
const morgan = require('morgan');
// const client = zomato.createClient({
//
//   var client = zomato.createClient({
//     userKey: 'API Token', "5db36dca76c586c0ab3ecc89f4cd85c2"
//   });

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

function create_hash (password) {
  var salt = crypto.randomBytes(20).toString('hex');
  var key = pbkdf2.pbkdf2Sync(
    password, salt, 36000, 256, 'sha256'
  );
  var hash = key.toString('hex');
  var stored_pass = `pbkdf2_sha256$36000$${salt}$${hash}`;
  return stored_pass;
}

function check_pass (stored_pass, password){
  // checking a password
  var pass_parts = stored_pass.split('$');
  var key = pbkdf2.pbkdf2Sync( // make new hash
    password,
    pass_parts[2],
    parseInt(pass_parts[1]),
    256, 'sha256'
  );

  var hash = key.toString('hex');
  if (hash === pass_parts[3]) {
    console.log('Passwords Matched!');
    return true
  }
  else {
    console.log('No match')
  }
  return false;
}

app.use(function(request, response, next){
  if(request.session.user) {
    next();
  } else if (request.path == '/submit_new') {
    response.redirect('/login');
  } else {
    next();
  }
});

app.get('/', function(request, response){
  context = {title: 'Search Restaurant Reviews', user: request.session.user, anon: !request.session.user}
  response.render('search_form.hbs', context)
})

//login page
app.get('/login', function(request, response){
  context = {title: 'Login'}
  response.render('login.hbs', context)
});

//login mechanics
app.post('/login', function(request, response) {
  let username = request.body.username;
  let password = request.body.password;
  let query = "SELECT password FROM reviewer WHERE name = $1"
  db.one(query, username)
    .then (function(stored_pass){
      // hash user input
      return check_pass(stored_pass.password, password)
    })
    .then (function(pass_success){
      if (pass_success) {
        request.session.user = username;
        response.redirect('/');
      }
      else if (!pass_success){
        context = {title: 'Login', fail: true}
        response.render('login.hbs', context)
      }
    })
})

app.get('/logout', function(request, response, next) {
  request.session.destroy(function(err){
    if(err){console.error('Something went wrong: '+ err);}
    response.redirect('/');
  });
})

app.get('/create_account', function(request, response) {
  context = {title: 'Create account', user: request.session.user, anon: !request.session.user};
  response.render('create_account.hbs', context)
});

app.post('/create_account', function(request, response, next){
  let name = request.body.username;
  let password = request.body.password;
  let email = request.body.email;
  let stored_pass = create_hash(password);
  let query = 'INSERT INTO reviewer VALUES (DEFAULT, $1, $2, $3)'
  db.none(query, [name, email, stored_pass])
    .then(function(){
      request.session.user = name
      response.redirect('/');
    })
    .catch(function(err){next(err)})
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



var PORT = process.env.PORT || 8000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);
});
