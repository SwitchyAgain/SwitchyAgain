import {optionPatch} from '../src/react/option_patch';

describe('option patch', () => {
  it('builds shallow option patches for changed keys', () => {
    expect(
      optionPatch(
        {
          keep: true,
          remove: 'old',
          replace: 'before'
        },
        {
          add: 'new',
          keep: true,
          replace: 'after'
        },
        ['add', 'keep', 'remove', 'replace']
      )
    ).toEqual({
      add: [undefined, 'new'],
      remove: ['old', undefined],
      replace: ['before', 'after']
    });
  });
});
