import * as Router from 'koa-router';
import { AliasesService } from '../../services/aliases';
import { AliasesServiceMgetRequest } from '../../services/aliases';
import { alias } from '../../types';
import { createHttpHandler } from '../_common';
import { postToGet } from '../_common/postToGet';
import {
  get as getSerializer,
  mget as mgetSerializer,
  search as searchSerializer,
} from '../_common/serialize';
import { get as parseGet, mgetOrSearch as parseMgetOrSearch } from './parse';

const subrouter: Router = new Router();

const isMgetRequest = (req: unknown): req is AliasesServiceMgetRequest =>
  typeof req === 'object' && req !== null && req.hasOwnProperty('ids');

const mgetOrSearchHandler = (aliasesService: AliasesService) =>
  createHttpHandler(
    req =>
      isMgetRequest(req)
        ? aliasesService.mget(req).map(mgetSerializer(alias))
        : aliasesService.search(req).map(searchSerializer(alias)),
    parseMgetOrSearch
  );

export default (aliasesService: AliasesService): Router => {
  return subrouter
    .get(
      '/aliases/:id',
      createHttpHandler(
        req => aliasesService.get(req).map(getSerializer(alias)),
        parseGet
      )
    )
    .get('/aliases', mgetOrSearchHandler(aliasesService))
    .post('/aliases', postToGet(mgetOrSearchHandler(aliasesService)));
};
