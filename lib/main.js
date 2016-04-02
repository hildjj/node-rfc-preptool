'use strict';

var bb = require('bluebird');
var fs = bb.promisifyAll(require('fs'));
var commander = require('commander');
var State = require('./state');

var program = new commander.Command;
program
  .arguments('<input> <output>')
  .option('-d, --debug [dir]', 'output each step to dir')
  .option('-v, --verbose', 'output the name of each step')
  .parse(process.argv);

var input  = program.args.shift();
var output = program.args.shift();
if (!input || !output) {
  program.help();
  process.exit(64);
}

var state = new State(input, program.debug, program.verbose);
state.run()
.then(_ => fs.writeFileAsync(output, state.data))
.catch((er) => {
  console.error("Error:", er.message, er.stack);
  process.exit(2);
});
