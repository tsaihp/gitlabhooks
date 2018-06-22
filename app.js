var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var slack = require('./slack');
var axios = require('axios');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const debug = (message, type) => {
  let d = new Date();
  console.log(`[${d.toLocaleString()} ${type.toUpperCase()}] ${message}`);
};

app.post('/webhook/gitlab', function(req, res, next) {
  res.json({
    rv: 'success',
  });
})

app.listen(5000, function () {
  debug('Listening on port 5000!', 'SYSTEM');

  slack.send("Webhooks service is Up !", undefined, [
    {
      text: `上線時間${(new Date()).toLocaleString()}`,
      color: '#000000',
    }
  ]);
});
