import { Task } from 'folktale/concurrency/task';
import { AppError } from '../../../errorHandling';
import { AssetsService } from '../../assets';
import { IssueTx } from './repo/types';

export const modifyDecimals = (assetsService: AssetsService) => (
  txs: IssueTx[]
): Task<AppError, IssueTx[]> =>
  assetsService
    .precisions({
      ids: ['WAVES'].concat(txs.map((tx) => tx.assetId)),
    })
    .map((precisions) => {
      const feePrecision = precisions.splice(0, 1)[0];
      return txs.map((tx, idx) => ({
        ...tx,
        fee: tx.fee.shiftedBy(-feePrecision),
        amount: tx.quantity.shiftedBy(-precisions[idx]),
      }));
    });
