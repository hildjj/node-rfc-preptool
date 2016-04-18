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
    const m = test.match(/^0*(\d+)_(id|rfc)(_fail)?.*\.xml$/i);
    if (m) {
      var ret = new State({
        step:   [parseInt(m[1]) / 10, 53],
        input:  path.join(__dirname, test),
        output: path.join(__dirname, "out", test),
        rfc:    m[2] === 'rfc',
        id:     m[2] === 'id'
      })
      .run();
      if (m[3]) {
        ret = ret.then(_ => {
          var er = new Error('Expected error, but got success');
          er.test = test;
          throw er;
        }, _ => {
          // expected.
        })
      } else {
        ret.catch(er => {
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
