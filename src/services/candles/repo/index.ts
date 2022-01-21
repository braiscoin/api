import { Ok as ok } from 'folktale/result';

import { CandleInfo, Interval, RepoSearch } from '../../../types';
import { CommonRepoDependencies } from '../..';

import { sql } from './sql';
import { output } from './schema';
import { transformResults } from './transformResults';

import { validateResult } from '../../_common/presets/validation';
import { getData } from '../../_common/presets/pg/search/pg';

import { search } from '../../_common/createResolver';

export type CandlesSearchRequest = {
  amountAsset: string;
  priceAsset: string;
  timeStart: Date;
  timeEnd: Date;
  interval: Interval;
  matcher: string;
};

export type CandlesRepo = RepoSearch<CandlesSearchRequest, CandleInfo>;

export default ({ drivers: { pg }, emitEvent }: CommonRepoDependencies): CandlesRepo => {
  const SERVICE_NAME = 'candles.search';
  return {
    search: search({
      transformInput: ok,
      transformResult: transformResults,
      validateResult: validateResult(output, SERVICE_NAME),
      getData: getData({
        name: SERVICE_NAME,
        sql,
        pg,
      }),
      emitEvent,
    }),
  };
};
