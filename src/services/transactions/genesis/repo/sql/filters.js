const { without, omit } = require('ramda');

const commonFilters = require('../../../_common/sql/filters');
const commonFiltersOrder = require('../../../_common/sql/filtersOrder');

module.exports = {
  filters: omit(['sender'], {
    ...commonFilters,
  }),

  filtersOrder: without('sender', [...commonFiltersOrder, 'recipient']),
};
