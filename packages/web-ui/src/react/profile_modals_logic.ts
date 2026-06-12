export type ProfileNameErrors = {
  conflict: boolean;
  required: boolean;
  reserved: boolean;
};

export function profileNameErrors(
  name: string,
  fromName: string,
  isProfileNameReserved?: (name: string) => boolean,
  profileByName?: (name: string) => unknown
): ProfileNameErrors {
  return {
    conflict: Boolean(name && name !== fromName && profileByName?.(name)),
    required: !name,
    reserved: Boolean(name && isProfileNameReserved?.(name))
  };
}

export function profileNameValid(errors: ProfileNameErrors) {
  return !errors.required && !errors.reserved && !errors.conflict;
}
