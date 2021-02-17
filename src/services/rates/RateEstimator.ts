import { rejected, Task } from 'folktale/concurrency/task';
import { Maybe, of as maybeOf } from 'folktale/maybe';
import { splitEvery, sequence } from 'ramda';
import { Asset, BigNumber } from '@waves/data-entities';

import { AppError, DbError, Timeout } from '../../errorHandling';
import { tap } from '../../utils/tap';
import { isEmpty } from '../../utils/fp/maybeOps';
import { RateInfo, RateMgetParams, RateWithPairIds } from '../../types';
import { WavesId } from '../..';
import { PairsService } from '../pairs';
import { AssetsService } from '../assets';
import { MoneyFormat } from '../types';

import { partitionByPreComputed, AsyncMget, RateCache } from './repo';
import { RateCacheKey } from './repo/impl/RateCache';
import RateInfoLookup from './repo/impl/RateInfoLookup';

type ReqAndRes<TReq, TRes> = {
  req: TReq;
  res: Maybe<TRes>;
};

export type AssetPair = {
  amountAsset: Asset;
  priceAsset: Asset;
};

export type RateWithPair = RateInfo & AssetPair;
export type VolumeAwareRateInfo = RateWithPair & { volumeWaves: BigNumber };

export default class RateEstimator
  implements
    AsyncMget<RateMgetParams, ReqAndRes<AssetPair, RateWithPairIds>, AppError> {
  constructor(
    private readonly cache: RateCache,
    private readonly remoteGet: AsyncMget<
      RateMgetParams,
      RateWithPairIds,
      DbError | Timeout
    >,
    private readonly pairs: PairsService,
    private readonly pairAcceptanceVolumeThreshold: number,
    private readonly assetsService: AssetsService
  ) {}

  mget(
    request: RateMgetParams
  ): Task<
    AppError | DbError | Timeout,
    ReqAndRes<AssetPair, RateWithPairIds>[]
  > {
    const { pairs, timestamp, matcher } = request;

    const shouldCache = isEmpty(timestamp);

    const getCacheKey = (pair: AssetPair): RateCacheKey => ({
      pair,
      matcher,
    });

    const cacheUnlessCached = (item: VolumeAwareRateInfo) => {
      const key = getCacheKey(item);
      if (!this.cache.has(key)) {
        this.cache.set(key, item);
      }
    };

    const cacheAll = (items: Array<VolumeAwareRateInfo>) =>
      items.forEach((it) => cacheUnlessCached(it));

    let ids = pairs.reduce((acc, cur) => {
      acc.push(cur.amountAsset, cur.priceAsset);
      return acc;
    }, new Array<string>());

    return this.assetsService.get({ id: WavesId }).chain((m) =>
      m.matchWith({
        Nothing: () => rejected(AppError.Db('Waves asset not found.')) as any,
        Just: ({ value: wavesAsset }) =>
          this.assetsService.mget({ ids }).chain((ms) =>
            sequence<Maybe<Asset>, Maybe<Asset[]>>(maybeOf, ms).matchWith({
              Nothing: () =>
                rejected(
                  AppError.Db(
                    'Some of the assets of specified pairs not found.'
                  )
                ) as any,
              Just: ({ value: assets }) => {
                let pairsWithAssets = splitEvery(2, assets).map(
                  ([amountAsset, priceAsset]) => ({
                    amountAsset,
                    priceAsset,
                  })
                );

                let assetsMap: Record<string, Asset> = {};
                assets.forEach((asset) => {
                  assetsMap[asset.id] = asset;
                });

                const { preComputed, toBeRequested } = partitionByPreComputed(
                  this.cache,
                  pairsWithAssets,
                  getCacheKey,
                  shouldCache,
                  wavesAsset
                );

                return this.remoteGet
                  .mget({
                    pairs: toBeRequested.map((pair) => ({
                      amountAsset: pair.amountAsset.id,
                      priceAsset: pair.priceAsset.id,
                    })),
                    matcher,
                    timestamp,
                  })
                  .chain((pairsWithRates) => {
                    return this.pairs
                      .mget({
                        pairs: pairsWithRates,
                        matcher: request.matcher,
                        moneyFormat: MoneyFormat.Long,
                      })
                      .map((foundPairs) => {
                        return foundPairs.map((itm, idx) =>
                          itm
                            .map((pair) => ({
                              amountAsset: assetsMap[pair.amountAsset],
                              priceAsset: assetsMap[pair.priceAsset],
                              volumeWaves: pair.volumeWaves,
                              rate: pairsWithRates[idx].rate,
                            }))
                            .getOrElse<VolumeAwareRateInfo>({
                              amountAsset:
                                assetsMap[pairsWithRates[idx].amountAsset],
                              priceAsset:
                                assetsMap[pairsWithRates[idx].priceAsset],
                              rate: pairsWithRates[idx].rate,
                              volumeWaves: new BigNumber(0),
                            })
                        );
                      });
                  })
                  .map(
                    tap((results) => {
                      if (shouldCache) cacheAll(results);
                    })
                  )
                  .map(
                    (data) =>
                      new RateInfoLookup(
                        [...data, ...preComputed],
                        this.pairAcceptanceVolumeThreshold,
                        wavesAsset
                      )
                  )
                  .map((lookup) => {
                    return pairsWithAssets.map((pair) => ({
                      req: pair,
                      res: lookup.get({
                        ...pair,
                        moneyFormat: MoneyFormat.Long,
                      }),
                    }));
                  })
                  .map(
                    tap((data) => {
                      data.forEach((reqAndRes) =>
                        reqAndRes.res.map(
                          tap((res) => {
                            if (shouldCache) {
                              cacheUnlessCached(res);
                            }
                          })
                        )
                      );
                    })
                  )
                  .map((rs) =>
                    rs.map((reqAndRes) => ({
                      ...reqAndRes,
                      res: reqAndRes.res.map((res) => ({
                        ...res,
                        amountAsset: res.amountAsset.id,
                        priceAsset: res.priceAsset.id,
                      })),
                    }))
                  );
              },
            })
          ),
      })
    );
  }
}
