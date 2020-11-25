import * as Router from 'koa-router';
import { CandlesService } from '../../services/candles';
import { createHttpHandler } from '../_common';
import { parse } from './parse';
import { serialize } from './serialize';

const subrouter: Router = new Router();

export default ({ search }: CandlesService): Router =>
  subrouter.get(
    '/candles/:amountAsset/:priceAsset',
    createHttpHandler(
      (req, lsnFormat) => search(req).map(res => serialize(res, lsnFormat)),
      parse
    )
  );
