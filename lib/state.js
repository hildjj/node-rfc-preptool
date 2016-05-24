'use strict';
const
  bb         = require('bluebird'),
  dataUri    = require('strong-data-uri'),
  mime       = require('mime'),
  slug       = require('slug'),
  urllibsync = require('urllib-sync'),
  xform      = require('xmljade').transform,
  xml        = require('libxmljs'),

  fs         = bb.promisifyAll(require('fs')),
  path       = require('path'),
  spawn      = require('child_process').spawn,
  url        = require('url'),
  number     = require('./number'),
  Version    = require('./version');

require('datejs');

function spawnAsync(cmd, args, env, input) {
  var ex = bb.defer();
  var out = bb.defer();

  const child = spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: env
  });

  var stderr = [];
  var stdout = [];
  child.stderr.on('data', buf => stderr.push(buf));
  child.stdout.on('data', buf => stdout.push(buf));
  child.stdout.on('end', _ => out.resolve(Buffer.concat(stdout)))

  child.on('exit', e => {
    if (e) {
      var msg = 'Exit code: ' + e + '\n' + Buffer.concat(stderr).toString();
      var er = new Error(msg);
      er.msg = msg;
      ex.reject(er);
    } else {
      ex.resolve();
    }
  });

  child.stdin.end(input);
  return bb.all([out.promise, ex.promise]).spread((ex) => ex);
}

class State {
  constructor(opts) {
    this.opts       = opts || {};
    this.input      = opts.input;
    this._data      = null;
    this._xml       = null;
    this.pubDate    = new Date();
    this.dir        = path.join(__dirname, '..', 'steps');
    const ri        = path.resolve(this.input);
    this.cwd        = path.dirname(ri);
    this.inputUri   = url.resolveObject('file://', ri);
    if (opts.data) {
      this.data = opts.data;
    } else if (opts.xml) {
      this.xml = opts.xml;
    }
  }

  _init() {
    return bb.all([
      bb.try(_ => {
        if (!this._data) {
          return fs.readFileAsync(this.input)
          .then((buf) => this.data = buf)
        }
      }),
      bb.try(_ => {
        // ensure debug directory is set up, if desired
        if (this.opts.debug) {
          return fs.statAsync(this.opts.debug)
          .then(_ => {
            // remove all existing files
            return fs.readdirAsync(this.opts.debug)
            .then((dir) => {
              return bb.each(dir, (f) => {
                return fs.unlinkAsync(path.join(this.opts.debug, f))
                .catch((e) => {
                  console.error('Warning:', e.message);
                });
              });
            });
          })
          .catch(_ => fs.mkdirAsync(this.opts.debug))
        }
      })
    ])
  }

  run() {
    return this._init()
    .then(_ => fs.readdirAsync(this.dir)) // TODO: cache
    .then((dir) => {
      dir = Version.makeAll(dir);

      if (this.opts.step && (this.opts.step.length > 0)) {
        let m = {}
        for (let d of dir) {
          m[d.strver] = d;
          m[d.desc] = d;
        }
        dir = this.opts.step.map(s => {
          if (m[s]) { return m[s]; }
          throw new Error(`Unknown step: "${s}"`);
        });
      }
      this.steps = dir;
      return bb.mapSeries(dir, (step) => {
        return this.step(step);
      });
    })
    .then(_ => {
      if (this.opts.output) {
        return fs.writeFileAsync(this.opts.output, this.data);
      }
      return this.data;
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
        const x = xml.parseXml(this._data);
        if (!x || (x.errors.length > 0)) {
          var msg = "XML Error\n";
          if (x) {
            for (var e of x.errors) {
              msg += `ERROR (input XML ${e.line}:${e.column}): ${e.message}`
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
    if (this.opts.debug) {
      return fs.writeFileAsync(path.join(this.opts.debug, this.step_name + ".xml"),
                               this.data);
    } else {
      return bb.resolve();
    }
  }
  step(ver) {
    const s = this['STEP_' + ver.typ];
    if (s) {
      this.step_name = ver.desc;
      this.step_file = path.join(this.dir, ver.nm);
      this.opts.verbose && console.log('Step %s: %s', ver.strver, ver.desc);
      return s.call(this)
      .then((d) => {
        if (d instanceof xml.Document) {
          this.xml = d;
        } else {
          this.data = d;
        }
        return this.writeDebug();
      });
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
          slug: slug,
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
    const f = require(this.step_file);
    return bb.resolve(f.call(this, this));
  }
}

module.exports = State;
