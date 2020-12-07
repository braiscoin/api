import { Task } from 'folktale/concurrency/task';
import { AppError } from '../../../errorHandling';
import { AssetsService } from '../../assets';
import { GenesisTx } from './repo/types';

export const modifyDecimals = (assetsService: AssetsService) => (
  txs: GenesisTx[]
): Task<AppError, GenesisTx[]> =>
  assetsService
    .precisions({
      ids: ['WAVES'],
    })
    .map(([assetPrecision]) =>
      txs.map((tx) => ({
        ...tx,
        fee: tx.fee.multipliedBy(10 ** -assetPrecision),
        amount: tx.amount.multipliedBy(10 ** -assetPrecision),
      }))
    );
