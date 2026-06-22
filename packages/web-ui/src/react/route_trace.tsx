import React, {useEffect, useMemo, useState} from 'react';
import {message} from './i18n_client';
import {explainRequest} from './options_api_client';
import type {Options, RequestExplanation, RequestExplainStep} from './options_client_types';
import {getState} from './state_client';
import {ProfileInline, ProfileSelect, allProfilesFromOptions, profileByName} from './profile_widgets';
import {formatRequestUrl, profileFromExplanation, routeTraceStepCondition, routeTraceSteps} from './route_trace_logic';

export type RouteTraceProps = {
  currentProfileName?: string;
  embedded?: boolean;
  options?: Options | null;
};

function FinalResult({explanation, options}: {explanation: RequestExplanation; options?: Options | null}) {
  const final = explanation.final;
  const profile = profileFromExplanation(options, final.profile || explanation.finalProfile);
  return (
    <span className="route-trace-final">
      {profile && <ProfileInline profile={profile} />}
      {final.kind === 'system' && <span className="text-muted">{message('routeTrace_systemProxy', 'System proxy')}</span>}
      {final.kind === 'pac' && <span className="text-muted">{message('routeTrace_pacScript', 'PAC script')}</span>}
      {final.pacResult && <code>{final.pacResult}</code>}
      {!profile && !final.pacResult && final.kind !== 'system' && final.kind !== 'pac' && (
        <span>{message('routeTrace_unknownResult', 'Unknown')}</span>
      )}
    </span>
  );
}

function StepTarget({options, step}: {options?: Options | null; step: RequestExplainStep}) {
  const profile = profileFromExplanation(options, step.targetProfile);
  if (profile) {
    return <ProfileInline profile={profile} />;
  }
  if (step.pacResult) {
    return <code>{step.pacResult}</code>;
  }
  return <span className="text-muted">{message('routeTrace_stop', 'Stop')}</span>;
}

function StepRow({options, step}: {options?: Options | null; step: RequestExplainStep}) {
  const labels: Record<string, string> = {
    attachedRuleList: message('routeTrace_step_attachedRuleList', 'Rule list rules'),
    bypass: message('routeTrace_step_bypass', 'Bypass'),
    default: message('routeTrace_step_default', 'Default'),
    direct: message('routeTrace_step_direct', 'Direct'),
    profile: message('routeTrace_step_profile', 'Profile'),
    proxy: message('routeTrace_step_proxy', 'Proxy'),
    rule: message('routeTrace_step_rule', 'Rule'),
    temporaryRule: message('routeTrace_step_temporaryRule', 'Temporary rule')
  };
  const condition = routeTraceStepCondition(step);
  return (
    <tr>
      <td className="route-trace-step-kind">{labels[step.kind] || step.kind}</td>
      <td className="route-trace-step-condition">{condition}</td>
      <td>
        <StepTarget options={options} step={step} />
      </td>
    </tr>
  );
}

function ExplanationResult({explanation, options}: {explanation: RequestExplanation; options?: Options | null}) {
  const currentProfile = profileFromExplanation(options, explanation.currentProfile);
  const startProfile = profileFromExplanation(options, explanation.startProfile);
  const steps = routeTraceSteps(explanation.steps);
  return (
    <section className="settings-group route-trace-result">
      <h3>{message('routeTrace_result', 'Result')}</h3>
      {explanation.tempRulesActive && (
        <p className="help-text text-warning">
          <span className="glyphicon glyphicon-filter" />{' '}
          {message(
            'routeTrace_tempRulesActive',
            'Temporary rules are active; requests are checked against temporary rules before the current profile.'
          )}
        </p>
      )}
      {explanation.errors?.map((error) => (
        <div className="alert alert-danger" role="alert" key={error}>
          <span className="glyphicon glyphicon-remove" /> {error}
        </div>
      ))}
      {explanation.warnings.includes('pacProfileLimited') && (
        <p className="help-text text-warning">
          <span className="glyphicon glyphicon-info-sign" />{' '}
          {message('routeTrace_pacLimited', 'PAC scripts are delegated to the browser and cannot be fully expanded here.')}
        </p>
      )}
      <table className="table table-condensed route-trace-summary">
        <tbody>
          <tr>
            <th>{message('routeTrace_request', 'Request')}</th>
            <td>
              <code>{formatRequestUrl(explanation.request.url)}</code>
            </td>
          </tr>
          <tr>
            <th>{message('routeTrace_currentProfile', 'Current profile')}</th>
            <td>{currentProfile ? <ProfileInline profile={currentProfile} /> : <span className="text-muted">-</span>}</td>
          </tr>
          <tr>
            <th>{message('routeTrace_startProfile', 'Start profile')}</th>
            <td>{startProfile ? <ProfileInline profile={startProfile} /> : <span className="text-muted">-</span>}</td>
          </tr>
          <tr>
            <th>{message('routeTrace_finalResult', 'Final result')}</th>
            <td>
              <FinalResult explanation={explanation} options={options} />
            </td>
          </tr>
        </tbody>
      </table>
      {steps.length > 0 && (
        <>
          <h3>{message('routeTrace_trace', 'Trace')}</h3>
          <table className="table table-condensed route-trace-steps">
            <thead>
              <tr>
                <th>{message('routeTrace_step', 'Step')}</th>
                <th>{message('routeTrace_condition', 'Condition')}</th>
                <th>{message('routeTrace_target', 'Target')}</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <StepRow key={`${step.kind}-${index}`} options={options} step={step} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export function RouteTrace({currentProfileName: initialCurrentProfileName, embedded = false, options}: RouteTraceProps) {
  const [url, setUrl] = useState('https://example.com/');
  const [profileName, setProfileName] = useState('');
  const [currentProfileName, setCurrentProfileName] = useState(initialCurrentProfileName || '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState<RequestExplanation | null>(null);
  const profiles = useMemo(() => allProfilesFromOptions(options), [options]);
  const currentProfile = profileByName(options, currentProfileName);

  useEffect(() => {
    if (initialCurrentProfileName) {
      setCurrentProfileName(initialCurrentProfileName);
    }
  }, [initialCurrentProfileName]);

  useEffect(() => {
    if (initialCurrentProfileName) {
      return;
    }
    getState<string>('currentProfileName')
      .then((name) => setCurrentProfileName(name || ''))
      .catch(() => {});
  }, [initialCurrentProfileName]);

  function explain(event: React.FormEvent) {
    event.preventDefault();
    setStatus('loading');
    setError('');
    setExplanation(null);
    explainRequest({
      url,
      profileName: profileName || undefined
    })
      .then((result) => {
        setExplanation(result);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err?.message || String(err));
        setStatus('error');
      });
  }

  const content = (
    <>
      <div className="page-header">
        <h2>{message('options_tab_routeTrace', 'Route Trace')}</h2>
      </div>
      <section className="settings-group width-limit route-trace-input">
        <form onSubmit={explain}>
          <div className="form-group">
            <label htmlFor="route-trace-url">URL</label>
            <input
              className="form-control"
              id="route-trace-url"
              spellCheck={false}
              type="text"
              value={url}
              onChange={(event) => setUrl(event.currentTarget.value)}
            />
          </div>
          <div className="form-group">
            <label>{message('routeTrace_profile', 'Profile')}</label>
            <div>
              <ProfileSelect
                defaultIcon="glyphicon-random"
                defaultText={message('routeTrace_currentAppliedProfile', 'Current applied profile')}
                inline
                name={profileName}
                options={options}
                profiles={profiles}
                onChange={setProfileName}
              />
              {!profileName && (
                <span className="route-trace-current">
                  {currentProfile ? <ProfileInline profile={currentProfile} /> : <span aria-hidden="true">&nbsp;</span>}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={status === 'loading' || !url.trim()}>
            <span className="glyphicon glyphicon-search" /> {message('routeTrace_explain', 'Trace')}
          </button>
        </form>
      </section>
      {status === 'error' && (
        <div className="alert alert-danger" role="alert">
          <span className="glyphicon glyphicon-remove" /> {error}
        </div>
      )}
      {status === 'loading' && <p className="text-muted">{message('routeTrace_loading', 'Loading...')}</p>}
      {explanation && <ExplanationResult explanation={explanation} options={options} />}
    </>
  );

  if (embedded) {
    return content;
  }
  return <main className="container-fluid react-options">{content}</main>;
}
