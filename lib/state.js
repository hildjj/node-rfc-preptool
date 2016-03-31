'use strict';
var bb = require('bluebird');
var dataUri = require('strong-data-uri');
var fs = bb.promisifyAll(require('fs'));
var mime = require('mime');
var xform = bb.promisify(require('xmljade').transform);
var path = require('path');
var url = require('url');
var urllibsync = require('urllib-sync');
var xml = require('libxmljs');
var spawn = require('child_process').spawn;
require('datejs');
var number = require('./number')

function spawnAsync(cmd, args, env, input) {
  return new bb((res, rej) => {
    var child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', process.stderr],
      env: env
    });

    child.on('error', (e)=> {
      rej(e);
    });

    // TODO: check return code.  Wait for both stdout.end and child.exit.
    var data = [];
    child.stdout.on('data', (buf) => {
      data.push(buf);
    });
    child.stdout.on('end', _ => {
      res(Buffer.concat(data));
    })
    child.stdin.end(input);
  });
}

class State {
  constructor(input, debug_dir) {
    this.dir = path.join(__dirname, '..', 'steps');
    this._data = null;
    this._xml = null;
    this.debug_file = null;
    this.debug_dir = debug_dir;
    this.pubDate = new Date();
    this.input = input;
    const ri = path.resolve(input);
    this.cwd = path.dirname(ri);
    this.inputUri = url.resolveObject('file://', ri);
  }

  _init() {
    return fs.readFileAsync(this.input)
    .then((buf) => {
      this.data = buf;

      // ensure debug directory is set up, if desired
      if (this.debug_dir) {
        return fs.statAsync(this.debug_dir)
        .then(_ => {
          // remove all existing files
          return fs.readdirAsync(this.debug_dir)
          .then((dir) => {
            return bb.each(dir, (f) => {
              return fs.unlinkAsync(path.join(this.debug_dir, f))
              .catch((e) => {
                console.error('Warning:', e.message);
              });
            });
          });
        })
        .catch(_ => fs.mkdirAsync(this.debug_dir))
      }
    })
  }

  run() {
    return this._init()
    .then(_ => fs.readdirAsync(this.dir))
    .then((dir) => {
      dir = dir.sort();
      return bb.mapSeries(dir, (step) => {
        return this.step(step);
      });
    })
  }

  get data() {
    if (!this._data) {
      if (!this._xml) {
        this._data = new Buffer(0);
      } else {
        this._data = new Buffer(this._xml.toString(), 'utf8');
      }
    }
    return this._data;
  }
  set data(data) {
    this._data = data;
    this._xml = null;
  }
  get xml() {
    if (!this._xml) {
      if (!this._data) {
        this._xml = new xml.Document();
      } else {
        //console.log("-----\n", this._data.toString('utf8'), "-----\n")
        var x = xml.parseXml(this._data);
        if (!x || (x.errors.length > 0)) {
          var msg = "XML Error\n";
          if (x) {
            for (var e of x.errors) {
              msg += "ERROR (input XML #{e.line}:#{e.column}): #{e.message}\n"
            }
          }
          console.log('throwing', msg)
          throw new Error(msg);
        }
        this._xml = x;
      }
    }
    return this._xml;
  }
  set xml(xml) {
    this._xml = xml;
    this._data = null;
  }
  writeDebug() {
    if (this.debug_dir) {
      return fs.writeFileAsync(path.join(this.debug_dir, this.step_name + ".xml"),
                               this.data);
    } else {
      return bb.resolve();
    }
  }
  step(name) {
    var m = name.match(/^0*(\d+)_([^.]+)\.([a-zA-Z0-9]+)$/);
    if (m) {
      var s = this['STEP_' + m[3]];
      if (s) {
        this.step_name = name;
        this.step_file = path.join(this.dir, name);
        console.log('Step %d: %s', m[1]/10, m[2]);
        return s.call(this)
        .then((d) => {
          this.data = d;
          return this.writeDebug();
        });
      }
    }
  }
  STEP_jade() {
    return fs.readFileAsync(this.step_file)
    .then((jade) => {
      return xform(jade, this.xml, {
        pretty: false,
        filename: this.step_file,
        define: {
          state: this,
          number: number,
          dataUri: dataUri,
          fs: fs,
          mime: mime,
          path: path,
          url: url,
          urllibsync: urllibsync,
          xml: xml
        }
      });
    });
  }
  STEP_cmd() {
    return spawnAsync('bash', ['-', this.step_file], {
      SOURCE_DIR: this.cwd,
      STEPS_DIR: path.join(__dirname, "..", "steps")
    }, this.data);
  }
  STEP_js() {
    var f = require(this.step_file);
    return bb.resolve(f.call(this, this));
  }
}

module.exports = State;
