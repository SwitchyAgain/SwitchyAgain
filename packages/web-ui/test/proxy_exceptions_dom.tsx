// @vitest-environment jsdom

import React, {useState} from 'react';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {ProxyExceptionsPage} from '../src/react/proxy_exceptions';
import type {Options} from '../src/react/options_client_types';

beforeEach(() => {
  (globalThis as any).ProxyEngine = {
    Profiles: {
      each(options: Options, callback: (key: string, profile: any) => void) {
        Object.entries(options).forEach(([key, profile]) => {
          if (key.startsWith('+')) callback(key, profile);
        });
      }
    }
  };
});

afterEach(() => cleanup());

function options(): Options {
  return {
    '-proxyExceptionsEnabled': true,
    '-globalBypassListId': 'supplemental-list-default',
    '-profileGroupsEnabled': true,
    '-profileGroups': [
      {
        color: '#99dd99',
        id: 'group-work',
        icon: 'glyphicon-home',
        name: 'Work Group',
        supplementalListIds: ['supplemental-list-work']
      }
    ],
    '-supplementalLists': [
      {
        id: 'supplemental-list-default',
        name: 'Default',
        bypassList: [{conditionType: 'BypassCondition', pattern: 'example.com'}],
        bypassGroups: []
      },
      {
        id: 'supplemental-list-work',
        name: 'Work',
        bypassList: [],
        bypassGroups: []
      }
    ],
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile',
      supplementalListIds: ['supplemental-list-work']
    }
  };
}

function Harness({initial = options(), onChange = () => {}}: {initial?: Options; onChange?: (options: Options) => void}) {
  const [value, setValue] = useState(initial);
  return (
    <ProxyExceptionsPage
      options={value}
      onOptionsChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

function listRow(name: string) {
  const table = screen.getByRole('columnheader', {name: 'List'}).closest('table') as HTMLTableElement;
  const row = Array.from(table.tBodies[0].rows).find((candidate) => candidate.cells[0].textContent?.trim().startsWith(name));
  if (!row) throw new Error(`Supplemental List row not found: ${name}`);
  return row;
}

describe('Proxy Exceptions page', () => {
  it('shows the main state and updates the Global mapping and selected list content', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(screen.getByRole('heading', {name: 'Proxy Exceptions'})).toBeTruthy();
    expect(screen.getByRole('columnheader', {name: 'Direct Profile Links'})).toBeTruthy();
    expect(screen.getByRole('columnheader', {name: 'Profile Group Links'})).toBeTruthy();
    expect(within(listRow('Default')).getByText('Global')).toBeTruthy();
    expect(listRow('Work').cells[1].textContent).toBe('1');
    expect(listRow('Work').cells[2].textContent).toBe('1');
    expect((within(listRow('Default')).getByTitle('The Default Supplemental List cannot be deleted.') as HTMLButtonElement).disabled).toBe(
      true
    );

    fireEvent.click(screen.getByRole('button', {name: 'Global Bypass List'}));
    const globalSelect = screen.getByRole('button', {name: 'Global Bypass List'}).parentElement as HTMLElement;
    fireEvent.click(within(globalSelect).getByText('Work'));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({'-globalBypassListId': 'supplemental-list-work'}));
    expect(within(listRow('Work')).getByText('Global')).toBeTruthy();

    const editor = screen.getByDisplayValue('example.com');
    fireEvent.change(editor, {target: {value: 'updated.example'}});
    fireEvent.blur(editor);

    const updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Options;
    expect(updated['-supplementalLists']?.[0].bypassList?.[0].pattern).toBe('updated.example');
  });

  it('manages direct Proxy Profile and Profile Group links', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(within(listRow('Work')).getByTitle('Manage Proxy Profile Links'));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Manage Proxy Profile Links for “Work”'})).toBeTruthy();
    expect(within(dialog).getByRole('columnheader', {name: 'Link'})).toBeTruthy();
    expect(within(dialog).getByRole('columnheader', {name: 'Proxy Profile'})).toBeTruthy();
    const profileCheckbox = within(dialog).getByRole('checkbox', {name: 'proxy'}) as HTMLInputElement;
    expect(profileCheckbox.closest('tr')?.querySelector('.glyphicon-globe')).toBeTruthy();
    fireEvent.click(within(dialog).getByText('proxy'));
    expect(profileCheckbox.checked).toBe(true);
    fireEvent.click(profileCheckbox);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));

    let updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Options;
    expect((updated['+proxy'] as {supplementalListIds?: string[]}).supplementalListIds).toEqual([]);
    expect(listRow('Work').cells[1].textContent).toBe('0');

    fireEvent.click(within(listRow('Work')).getByTitle('Manage Profile Group Links'));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', {name: 'Manage Profile Group Links for “Work”'})).toBeTruthy();
    expect(within(dialog).getByRole('columnheader', {name: 'Link'})).toBeTruthy();
    expect(within(dialog).getByRole('columnheader', {name: 'Profile Group'})).toBeTruthy();
    const groupCheckbox = within(dialog).getByRole('checkbox', {name: 'Work Group'});
    const groupIcon = groupCheckbox.closest('tr')?.querySelector('.glyphicon-home') as HTMLElement;
    expect(groupIcon).toBeTruthy();
    expect(groupIcon.style.color).toBe('rgb(153, 221, 153)');
    fireEvent.click(within(dialog).getByText('Work Group'));
    expect((groupCheckbox as HTMLInputElement).checked).toBe(true);
    fireEvent.click(groupCheckbox);
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));

    updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Options;
    expect(updated['-profileGroups']?.[0].supplementalListIds).toEqual([]);
    expect(listRow('Work').cells[2].textContent).toBe('0');
  });

  it('creates and renames a Supplemental List', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', {name: 'New List'}));
    let dialog = screen.getByRole('dialog');
    const createInput = dialog.querySelector('input') as HTMLInputElement;
    fireEvent.change(createInput, {target: {value: 'Personal'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Create'}));

    fireEvent.click(within(listRow('Personal')).getByTitle('Rename'));
    dialog = screen.getByRole('dialog');
    const renameInput = dialog.querySelector('input') as HTMLInputElement;
    fireEvent.change(renameInput, {target: {value: 'Private'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));

    expect(listRow('Private')).toBeTruthy();
  });

  it('shows linked items before deleting and removes their links', () => {
    const source = options();
    source['-globalBypassListId'] = 'supplemental-list-work';
    const onChange = vi.fn();
    render(<Harness initial={source} onChange={onChange} />);

    fireEvent.click(within(listRow('Work')).getByTitle('Delete'));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('Linked Proxy Profiles')).toBeTruthy();
    expect(within(dialog).getByText('proxy')).toBeTruthy();
    expect(within(dialog).getByText('Linked Profile Groups')).toBeTruthy();
    expect(within(dialog).getByText('Work Group')).toBeTruthy();
    expect(within(dialog).getByText('Deleting this Supplemental List will also remove all links shown above.')).toBeTruthy();
    expect(within(dialog).getByText(/The Default list will become the Global Bypass List/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    const updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Options;
    expect(updated['-globalBypassListId']).toBe('supplemental-list-default');
    expect(updated['-supplementalLists']?.map((list) => list.id)).toEqual(['supplemental-list-default']);
    expect((updated['+proxy'] as {supplementalListIds?: string[]}).supplementalListIds).toEqual([]);
    expect(updated['-profileGroups']?.[0].supplementalListIds).toEqual([]);
  });
});
