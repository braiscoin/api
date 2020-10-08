import { Task } from 'folktale/concurrency/task';
import { AppError } from '../../../errorHandling';
import { AssetsService } from '../../assets';
import { PaymentTx } from './repo/types';

export const modifyDecimals = (assetsService: AssetsService) => (
  txs: PaymentTx[]
): Task<AppError, PaymentTx[]> =>
  assetsService
    .precisions({
      ids: ['WAVES'],
    })
    .map(([assetPrecision]) =>
      txs.map((tx) => ({
        ...tx,
        fee: tx.fee.dividedBy(10 ** assetPrecision),
        amount: tx.amount.dividedBy(10 ** assetPrecision),
      }))
    );
