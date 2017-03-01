/* eslint new-cap: ["error", { "capIsNewExceptions": ["RECEIVED_COLOR", "EXPECTED_COLOR"] }] */

import _ from 'lodash';
import chalk from 'chalk';
import {
  RECEIVED_COLOR,
  EXPECTED_COLOR,
  getType,
  matcherHint,
  printExpected,
  printReceived,
  printWithType,
  stringify,
} from 'jest-matcher-utils';

const ensureQueried = (mock, matcherName) => {
  if (!jest.isMockFunction(mock)) {
    throw new Error(
      `${matcherHint(`[.not]${matcherName}`, 'jest.fn()', '')}\n\n` +
      `${RECEIVED_COLOR('jest.fn()')} value must be a mock function or spy.\n` +
      `${printWithType('Received', mock, printReceived)}`,
    );
  }
};

const equalsValue = (actual, expected) => {
  if (_.isPlainObject(expected) || _.isArray(expected)) {
    if (!_.isString(actual)) return false;
    return _.isEqual(JSON.parse(actual), expected);
  }

  if (_.isRegExp(expected)) return expected.test(actual);

  if (expected === Date) return `${actual}` === `${new Date(actual)}`;

  if (_.isFunction(expected)) return expected(actual);

  return `${actual}` === `${expected}`;
};

const equalsQueried = (actual, expected) => {
  const compared = _.mapKeys(expected, (value, key) => _.snakeCase(key));

  const keys = _.sortedUniq(_.concat(_.keys(actual), _.keys(compared)).sort());
  return !_.find(keys, (key) => {
    if (_.isUndefined(actual[key]) || _.isUndefined(compared[key])) {
      return true;
    }

    return !equalsValue(actual[key], compared[key]);
  });
};

const diffQuery = (actual, expected) => {
  const result = [];
  const compared = _.mapKeys(expected, (value, key) => _.snakeCase(key));

  const keys = _.sortedUniq(_.concat(_.keys(actual), _.keys(compared)).sort());
  _.forEach(keys, (key) => {
    if (_.isUndefined(compared[key])) {
      result.push(RECEIVED_COLOR(`+ ${key}: ${stringify(actual[key])}`));
      return;
    } else if (_.isUndefined(actual[key])) {
      result.push(EXPECTED_COLOR(`- ${key}: ${stringify(compared[key])}`));
      return;
    }

    if (!equalsValue(actual[key], compared[key])) {
      result.push(EXPECTED_COLOR(`- ${key}: ${stringify(compared[key])}`));
      result.push(RECEIVED_COLOR(`+ ${key}: ${stringify(actual[key])}`));
      return;
    }

    result.push(chalk.dim(`  ${key}: ${stringify(actual[key])}`));
  });

  return `${EXPECTED_COLOR('- Expected')}\n${RECEIVED_COLOR('+ Received')}\n\n${result.join('\n')}`;
};

const parseQuery = (builder) => {
  if (!builder) return {};

  const regex = /^insert /i.test(builder.sql) ? /"[\w_-]+"[,)]/gi : /"?([\w_]+)"?[ =]+\?/gi;
  const keys = _.map(builder.sql.match(regex), key => /([\w_]+)/gi.exec(key)[1]);

  const table = /(insert into|update|from) "([^"]+)"/i.exec(builder.sql);

  return {
    ..._.mapValues(_.invert(keys), index => builder.bindings[index]),
    table: table && table[2],
    method: builder.method === 'del' ? 'delete' : builder.method,
  };
};

export const toHaveBeenQueriedWith = (actual, expected) => {
  ensureQueried(actual, 'toHaveBeenQueriedWith');

  const compiler = _.get(actual, 'mock.calls', []).map(value => parseQuery(value[1]));

  let pass;
  if (_.isArray(expected)) {
    pass = !_.find(expected, (item, index) => item && !equalsQueried(compiler[index] || {}, item));
  } else {
    pass = !!_.find(compiler, item => equalsQueried(item, expected));
  }

  const message = pass
    ? () => `${matcherHint('.not.toHaveBeenQueriedWith', getType(actual))}\n\n` +
      'Expected not to have been queried with:\n' +
      `  ${printExpected(expected)}\n` +
      'Instead, it queried:\n' +
      `  ${printReceived(compiler)}\n`
    : () => {
      const diffString = _.map(
        compiler,
        (item, idx) => diffQuery(item, _.get(expected, idx, {})),
      ).join('\n\n');
      return `${matcherHint('.toHaveBeenQueriedWith', getType(actual))}\n\n` +
        'Expected to have been queried with:\n' +
        `  ${printExpected(expected)}\n` +
        'Instead, it queried:\n' +
        `  ${printReceived(compiler)}\n` +
        `\n\nDifference:\n\n${diffString}`;
    };

  return { pass, message };
};

export const toHaveBeenLastQueriedWith = (actual, expected) => {
  ensureQueried(actual, 'toHaveBeenLastQueriedWith');

  const builder = _.get(actual, 'mock.calls', []).map(value => value[1]);

  const compiler = parseQuery(builder[builder.length - 1]);

  const pass = equalsQueried(compiler, expected);

  const message = pass
    ? () => `${matcherHint('.not.toHaveBeenLastQueriedWith', getType(actual))}\n\n` +
      'Expected not to have been queried with:\n' +
      `  ${printExpected(expected)}\n` +
      'Instead, it queried:\n' +
      `  ${printReceived(compiler)}\n`
    : () => {
      const diffString = diffQuery(compiler, expected);
      return `${matcherHint('.toHaveBeenLastQueriedWith', getType(actual))}\n\n` +
        'Expected to have been queried with:\n' +
        `  ${printExpected(expected)}\n` +
        'Instead, it queried:\n' +
        `  ${printReceived(compiler)}\n` +
        `\n\nDifference:\n\n${diffString}`;
    };


  return { pass, message };
};

module.exports = {
  toHaveBeenQueriedWith: () => ({ compare: toHaveBeenQueriedWith }),
  toHaveBeenLastQueriedWith: () => ({ compare: toHaveBeenLastQueriedWith }),
};
