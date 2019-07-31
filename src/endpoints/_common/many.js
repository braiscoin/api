const { has } = require('ramda');

const { DEFAULT_NOT_FOUND_MESSAGE } = require('../../errorHandling');
const { captureErrors } = require('../../utils/captureErrors');
const { handleError } = require('../../utils/handleError');
const { select } = require('../utils/selectors');

const { parseFilterValues } = require('./filters');

const createManyMiddleware = (
  { parseFiltersFn, filterParsers, mgetFilterName },
  url,
  service
) => {
  return captureErrors(handleError)(async ctx => {
    if (!service.mget && !service.search) {
      ctx.status = 404;
      ctx.body = {
        message: DEFAULT_NOT_FOUND_MESSAGE,
      };
      return;
    }

    const { query } = select(ctx);
    const fValues = parseFiltersFn
      ? parseFiltersFn(query)
      : parseFilterValues(filterParsers)(query);

    ctx.eventBus.emit('ENDPOINT_HIT', {
      url: ctx.originalUrl,
      resolver: `${url}`,
      query,
    });

    let results;
    if (has(mgetFilterName, fValues)) {
      // mget hit
      if (service.mget) {
        results = await service
          .mget(fValues[mgetFilterName])
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
  });
};

module.exports = createManyMiddleware;
