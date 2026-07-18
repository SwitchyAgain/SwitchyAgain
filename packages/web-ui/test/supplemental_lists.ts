import {
  addSupplementalList,
  ensureDefaultSupplementalList,
  supplementalListNameError,
  supplementalListsForOptions
} from '../src/react/supplemental_lists';
import type {Options} from '../src/react/options_client_types';

describe('supplemental lists', () => {
  it('creates the protected Default list and repairs invalid Global mappings', () => {
    const options: Options = {};

    const list = ensureDefaultSupplementalList(options);

    expect(list).toEqual({
      id: 'supplemental-list-default',
      name: 'Default',
      bypassList: [],
      bypassSections: []
    });
    expect(options['-globalBypassListId']).toBe(list.id);
    expect(supplementalListsForOptions(options)).toEqual([list]);

    const invalidOptions: Options = {
      '-globalBypassListId': 'missing',
      '-supplementalLists': [
        {
          id: 'supplemental-list-existing',
          name: 'Existing'
        }
      ]
    };

    ensureDefaultSupplementalList(invalidOptions);

    expect(supplementalListsForOptions(invalidOptions)).toHaveLength(2);
    expect(invalidOptions['-globalBypassListId']).toBe('supplemental-list-default');
  });

  it('uses readable collision-safe ids and rejects duplicate names', () => {
    const options: Options = {};
    const first = addSupplementalList(options, 'Work Sites');
    const second = addSupplementalList(options, 'Work Sites');
    const lists = supplementalListsForOptions(options);

    expect(first.id).toBe('supplemental-list-work-sites');
    expect(second.id).toBe('supplemental-list-work-sites-2');
    expect(options['-globalBypassListId']).toBe(first.id);
    expect(supplementalListNameError(' work sites ', lists)).toBe('A Supplemental List with this name already exists.');
  });
});
