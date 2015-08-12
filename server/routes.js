//------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//------------------------------------------------------------------------------

var express = require('express');
var router = express.Router();
var alchemy = require('./alchemy');
var _ = require('lodash');

/* GET home page. */
router.get('/', function (req, res) {
  res.render('index');
});

/**
 * Load news articles and flatten them in to name/value pairs for either entities, concepts, or keywords.
 * Query params are:
 *   start
 *   end
 *   type - one of 'entities', 'concepts', or 'keywords'. defaults to 'concepts' if not sepcified
 */
router.get('/newsinsights', function (req, res) {
  var start = req.query.start || 'now-1d';
  var end = req.query.end || 'now';
  var type = req.query.type || 'concepts';

  alchemy.news({
    start: start,
    end: end,
    maxResults: 100,
    return: getReturnInfoArray(type).join(',')
  }, function (response) {
    if (response.status === 'ERROR') {
      res.status(400);
      res.json(response);
    } else {
      res.json(collapseResponse(response));
    }
  });
});

/**
 * Convert a response of that looks like {result: {docs: [ {source: {enriched: {url: {type: {text: ...
 * to an array of names and values. The values represent how many times that entity/concept/keyword
 * is represented in the response.
 */
function collapseResponse (response) {
  // first build a map of {name: value} pairs
  var map = {};
  var arr = _(response.result.docs)
    .map(function (d) {return d.source.enriched.url[type]})
    .flatten()
    .forEach(function (d) {
      var newAmount = type === 'entities' ? d.count : 1;
      if (map[d.text]) {
        map[d.text] += newAmount;
      } else {
        map[d.text] = newAmount;
      }
    })
    .value();
  // convert the map into an array of {name: name, value: value} objects
  var newResponse = [];
  var awesome = _.forOwn(map, function (value, key) {
    newResponse.push({name: key, value: value});
  });
  return newResponse.filter(function(d) {return d.value > 2});
}

/**
 * Return an array of strings to request from AlchemyAPI
 */
function getReturnInfoArray (type) {
  var baseReturnInfo = [
    // 'enriched.url.title',
    // 'enriched.url.docSentiment.type',
    // 'enriched.url.docSentiment.score',
    // 'enriched.url.docSentiment.mixed'
  ];
  var returnInfo;
  switch (type) {
    case 'entities':
      returnInfo = baseReturnInfo.concat(
        'enriched.url.entities.entity.text',
        'enriched.url.entities.entity.type',
        'enriched.url.entities.entity.sentiment',
        'enriched.url.entities.entity.count'
      );
      break;

    case 'concepts':
      returnInfo = baseReturnInfo.concat('enriched.url.concepts.concept.text');
      break;

    case 'keywords':
      returnInfo = baseReturnInfo.concat(
        'enriched.url.keywords.keyword.text',
        'enriched.url.keywords.keyword.sentiment'
      );
      break;

    default:
      // no op
  }
  return returnInfo;
}

module.exports = router;
