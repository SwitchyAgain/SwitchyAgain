import {profileNameErrors, profileNameValid} from '../src/react/profile_modals_logic';

describe('profile modal logic', () => {
  it('requires a profile name', () => {
    const errors = profileNameErrors('', '', undefined, undefined);

    expect(errors).toEqual({
      conflict: false,
      required: true,
      reserved: false
    });
    expect(profileNameValid(errors)).toBe(false);
  });

  it('marks reserved names without checking conflicts first', () => {
    const errors = profileNameErrors(
      '__reserved',
      '',
      (name) => name.startsWith('__'),
      () => ({
        name: '__reserved'
      })
    );

    expect(errors).toEqual({
      conflict: true,
      required: false,
      reserved: true
    });
    expect(profileNameValid(errors)).toBe(false);
  });

  it('allows renaming to the original name even when it exists', () => {
    const errors = profileNameErrors('proxy', 'proxy', undefined, () => ({
      name: 'proxy'
    }));

    expect(errors).toEqual({
      conflict: false,
      required: false,
      reserved: false
    });
    expect(profileNameValid(errors)).toBe(true);
  });

  it('detects conflicting names for new profiles and renames', () => {
    const errors = profileNameErrors('proxy', 'direct', undefined, () => ({
      name: 'proxy'
    }));

    expect(errors).toEqual({
      conflict: true,
      required: false,
      reserved: false
    });
    expect(profileNameValid(errors)).toBe(false);
  });

  it('accepts unique non-reserved names', () => {
    const errors = profileNameErrors(
      'proxy',
      '',
      (name) => name.startsWith('__'),
      () => null
    );

    expect(errors).toEqual({
      conflict: false,
      required: false,
      reserved: false
    });
    expect(profileNameValid(errors)).toBe(true);
  });
});
