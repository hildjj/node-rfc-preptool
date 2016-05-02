"use strict";
const Version = require('../lib/version');

var v = new Version('5.4.1_expiresdate-insertion.jade', '5.4.1', 'expiresdate-insertion', 'jade')
console.log(v);
var a = Version.makeAll(['5.4.1_expiresdate-insertion.jade']);
console.log(a);
