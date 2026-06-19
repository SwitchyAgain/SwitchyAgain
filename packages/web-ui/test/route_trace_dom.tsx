// @vitest-environment jsdom

import React from 'react';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {RouteTrace} from '../src/react/route_trace';
import type {Options, RequestExplanation} from '../src/react/options_client_types';

const optionsClientMock = vi.hoisted(() => ({
  explainRequest: vi.fn(),
  getState: vi.fn()
}));

vi.mock('../src/react/options_api_client', () => ({
  explainRequest: optionsClientMock.explainRequest
}));

vi.mock('../src/react/state_client', () => ({
  getState: optionsClientMock.getState
}));

vi.mock('../src/react/i18n_client', () => ({
  message(_key: string, fallback = '') {
    return fallback;
  }
}));

function optionsFixture(): Options {
  return {
    '+proxy': {
      name: 'proxy',
      profileType: 'FixedProfile'
    }
  };
}

function explanationFixture(url: string): RequestExplanation {
  return {
    currentProfile: {
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    final: {
      kind: 'profile',
      profile: {
        builtin: true,
        name: 'direct',
        profileType: 'DirectProfile'
      }
    },
    request: {
      url
    },
    startProfile: {
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    steps: [
      {
        condition: '*.example.com',
        kind: 'rule',
        targetProfile: {
          name: 'proxy',
          profileType: 'FixedProfile'
        }
      }
    ],
    tempRulesActive: true,
    warnings: ['pacProfileLimited']
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  optionsClientMock.explainRequest.mockReset();
  optionsClientMock.getState.mockReset();
  optionsClientMock.getState.mockResolvedValue('proxy');
});

describe('route trace component', () => {
  it('uses a provided current profile without loading state again', () => {
    render(<RouteTrace currentProfileName="proxy" embedded options={optionsFixture()} />);

    expect(screen.getByText('proxy')).toBeTruthy();
    expect(optionsClientMock.getState).not.toHaveBeenCalled();
  });

  it('submits trace requests and renders returned explanations', async () => {
    optionsClientMock.explainRequest.mockResolvedValue(explanationFixture('https://example.com/path?x=1'));

    render(<RouteTrace embedded options={optionsFixture()} />);

    await screen.findByText('proxy');

    fireEvent.change(screen.getByLabelText('URL'), {
      target: {
        value: 'https://example.com/path?x=1'
      }
    });
    fireEvent.click(screen.getByRole('button', {name: 'Trace'}));

    expect(optionsClientMock.explainRequest).toHaveBeenCalledWith({
      profileName: undefined,
      url: 'https://example.com/path?x=1'
    });
    expect(await screen.findByText('Result')).toBeTruthy();
    expect(
      screen.getByText('Temporary rules are active; requests are checked against temporary rules before the current profile.')
    ).toBeTruthy();
    expect(screen.getByText('PAC scripts are delegated to the browser and cannot be fully expanded here.')).toBeTruthy();
    expect(screen.getByText('*.example.com')).toBeTruthy();
    expect(screen.getByRole('heading', {name: 'Trace'})).toBeTruthy();
  });

  it('disables empty submissions and shows explain errors', async () => {
    optionsClientMock.explainRequest.mockRejectedValue(new Error('No route info'));

    render(<RouteTrace embedded options={optionsFixture()} />);

    const urlInput = screen.getByLabelText('URL');
    const traceButton = screen.getByRole('button', {name: 'Trace'}) as HTMLButtonElement;

    fireEvent.change(urlInput, {
      target: {
        value: ''
      }
    });
    expect(traceButton.disabled).toBe(true);

    fireEvent.change(urlInput, {
      target: {
        value: 'https://error.example/'
      }
    });
    fireEvent.click(traceButton);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No route info');
    await waitFor(() => {
      expect(optionsClientMock.explainRequest).toHaveBeenCalledWith({
        profileName: undefined,
        url: 'https://error.example/'
      });
    });
  });
});
