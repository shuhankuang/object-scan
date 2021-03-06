const expect = require('chai').expect;
const { describe } = require('node-tdd');
const generateParsedNeedle = require('../helper/generate-parsed-needle');

describe('Testing generate-parsed-needle.js', { cryptoSeed: '04eb4846-3b0c-4168-82fe-5a955f5161e3' }, () => {
  it('Testing example', () => {
    expect(generateParsedNeedle()).to.deep.equal(
      new Set([
        [
          new Set(['\\!', ['"'], '[9]']),
          ['[11]', '[6]', '#'],
          ['[3]', new Set(['[12]', '[1]']), '[14]', '[2]'],
          '$'
        ],
        new Set([
          '[13]',
          new Set(['[8]', '%', new Set(['[4]', '&', '\'']), '\\('])
        ]),
        new Set(['\\)'])
      ])
    );
  });
});
