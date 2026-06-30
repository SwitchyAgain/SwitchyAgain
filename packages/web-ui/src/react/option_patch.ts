import type {Options, OptionsPatch} from './options_client_types';

export function optionPatch(before: Options, after: Options, keys: string[]) {
  const patch: OptionsPatch = {};
  for (const key of keys) {
    if (before[key] !== after[key]) {
      patch[key] = [before[key], after[key]];
    }
  }
  return patch;
}
