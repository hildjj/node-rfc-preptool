'use strict';

var bb = require('bluebird');
var fs = bb.promisifyAll(require('fs'));
var path = require('path');
var commander = require('commander');
var dentin = require('dentin');
var State = require('./lib/state');

var program = new commander.Command;
program
  .arguments('<input> <output>')
  .option('-d, --debug [dir]', 'output each step to dir')
  .parse(process.argv);

var input  = program.args.shift();
var output = program.args.shift();
if (!input || !output) {
  program.help();
  process.exit(64);
}

var state = new State(input, program.debug);
state.run()
.then(_ => fs.writeFileAsync(output, state.data))
.catch((er) => {
  console.error("Error:", er.message, er.stack);
  process.exit(2);
});
