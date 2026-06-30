import Conditions from './conditions';
import * as PacGenerator from './pac_generator';
import Profiles from './profiles';
import * as RuleList from './rule_list';
import * as ShexpUtils from './shexp_utils';
import * as utils from './utils';

const proxyEngine: Record<string, unknown> = {
  Conditions,
  PacGenerator,
  Profiles,
  RuleList,
  ShexpUtils
};

const utilExports = utils as Record<string, unknown>;
for (const name of Object.keys(utilExports)) {
  proxyEngine[name] = utilExports[name];
}

export {Conditions, PacGenerator, Profiles, RuleList, ShexpUtils};

export * from './utils';

export default proxyEngine;
