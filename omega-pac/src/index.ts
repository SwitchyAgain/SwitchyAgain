import Conditions = require('./conditions');
import * as PacGenerator from './pac_generator';
import Profiles = require('./profiles');
import * as RuleList from './rule_list';
import * as ShexpUtils from './shexp_utils';
import * as utils from './utils';

const omegaPac: Record<string, unknown> = {
  Conditions,
  PacGenerator,
  Profiles,
  RuleList,
  ShexpUtils
};

const utilExports = utils as Record<string, unknown>;
for (const name of Object.keys(utilExports)) {
  omegaPac[name] = utilExports[name];
}

export = omegaPac;
