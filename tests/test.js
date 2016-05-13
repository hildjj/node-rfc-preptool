'use strict';
const
  bb     = require('bluebird'),
  fs     = bb.promisifyAll(require('fs')),
  path   = require('path'),
  dentin = require('dentin'),
  State  = require('../lib/state');

process.chdir(__dirname);
fs.readdirAsync(__dirname)
.then((dir) => {
  dir.sort();
  return bb.mapSeries(dir, (test) => {
    const m = test.match(/^([^0_]+)(_id|_rfc)?(_fail)?(_[0-9]+)?.*\.xml$/i);
    if (m) {
      var st = new State({
        step:   [m[1], 'pretty'],
        input:  path.join(__dirname, test),
        output: path.join(__dirname, "out", test),
        rfc:    m[2] === '_rfc',
        id:     m[2] === '_id',
        verbose: true
      });
      console.log('----', m[1], m[2] ? m[2] : "''", m[3] ? m[3] : "''", m[4]);
      var ret = st.run();
      if (m[3]) {
        ret = ret.then(_ => {
          var er = new Error('Expected error, but got success');
          er.test = test;
          throw er;
        }, e => {
          // expected.
          return fs.writeFileAsync(st.opts.output, e.msg || e.message || e.toString());
        })
      } else {
        ret = ret.catch(er => {
          er.test = test;
          throw er;
        })
      }
      return ret;
    }
  })
})
.catch(er => {
  if (er.msg) {
    console.error(`ERROR in "${er.test}" (input line ${er.line}): ${er.msg}`);
  } else {
    console.error(er);
  }
  process.exit(1);
});
