const { has, defaultTo, map, split, zipObj, compose } = require('ramda');
const Maybe = require('folktale/maybe');

const createManyMiddleware = require('../_common/many');

const { parseArrayQuery } = require('../utils/parseArrayQuery');
const { parseBool } = require('../utils/parseBool');
const { limit, query } = require('../_common/filters');

const options = loadConfig();

/**
 * @typedef {object} PairRequest
 * @property {string} amountAsset
 * @property {string} priceAsset
 */

/**
 * @function
 * @param {string[]} pairs {amoutAsset}/{priceAsset}
 * @returns PairRequest[]
 */
const parsePairs = map(
  compose(
    zipObj(['amountAsset', 'priceAsset']),
    split('/')
  )
);

/**
 * Endpoint
 * @name /pairs?pairs[]‌="{asset_id_1}/{asset_id_2}"&pairs[]="{asset_id_1}/{asset_id_2}" ...other params
 */
const pairsManyEndpoint = service => async ctx => {
  const { query } = select(ctx);
  const fValues = parseFilterValues(filterParsers)(query);

  ctx.eventBus.emit('ENDPOINT_HIT', {
    url: ctx.originalUrl,
    resolver: '/pairs',
    query,
  });

  let results;
  if (has(mgetFilterName, fValues)) {
    // mget hit
    if (service.mget) {
      results = await service
        .mget({ pairs: fValues.pairs, matcher: fValues.matcher })
        .run()
        .promise();
    } else {
      ctx.status = 404;
      ctx.body = {
        message: DEFAULT_NOT_FOUND_MESSAGE,
      };
      return;
    }
  } else {
    // search hit
    if (service.search) {
      results = await service
        .search(fValues)
        .run()
        .promise();
    } else {
      ctx.status = 404;
      ctx.body = {
        message: DEFAULT_NOT_FOUND_MESSAGE,
      };
      return;
    }
  }

  ctx.eventBus.emit('ENDPOINT_RESOLVED', {
    value: results,
  });

  if (results) {
    ctx.state.returnValue = results;
  } else {
    ctx.status = 404;
    ctx.body = {
      message: DEFAULT_NOT_FOUND_MESSAGE,
    };
  }
};

module.exports = service =>
  captureErrors(handleError)(pairsManyEndpoint(service));
