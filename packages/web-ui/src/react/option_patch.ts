import type {Options, OptionsPatch} from './options_client_types';
import {sameValue} from './options_logic';

export function optionPatch(before: Options, after: Options, keys: string[]) {
  const patch: OptionsPatch = {};
  for (const key of keys) {
    if (!sameValue(before[key], after[key])) {
      patch[key] = [before[key], after[key]];
    }
  }
  return patch;
}
