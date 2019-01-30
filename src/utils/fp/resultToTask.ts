import { of as taskOf, rejected } from 'folktale/concurrency/task';
import { Result } from 'folktale/result';

export const resultToTask = <A, B>(r: Result<A, B>) =>
  r.matchWith({
    Ok: ({ value }) => taskOf<A, B>(value),
    Error: ({ value }) => rejected<A, B>(value),
  });
