'use strict';
const
  bb         = require('bluebird'),
  dataUri    = require('strong-data-uri'),
  mime       = require('mime'),
  slug       = require('slug'),
  urllibsync = require('urllib-sync'),
  xform      = bb.promisify(require('xmljade').transform),
  xml        = require('libxmljs'),

  fs         = bb.promisifyAll(require('fs')),
  path       = require('path'),
  spawn      = require('child_process').spawn,
  url        = require('url'),
  number     = require('./number');

require('datejs');

function spawnAsync(cmd, args, env, input) {
  return new bb((res, rej) => {
    const child = spawn(cmd, args, {
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
  }

  _init() {
    return fs.readFileAsync(this.input)
    .then((buf) => {
      this.data = buf;

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
    .then(_ => {
      if (this.opts.output) {
        return fs.writeFileAsync(this.opts.output, this.data);
      }
      process.stdout.write(this.data);
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
        const x = xml.parseXml(this._data);
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
    if (this.opts.debug) {
      return fs.writeFileAsync(path.join(this.opts.debug, this.step_name + ".xml"),
                               this.data);
    } else {
      return bb.resolve();
    }
  }
  step(name) {
    const m = name.match(/^0*(\d+)_([^.]+)\.([a-zA-Z0-9]+)$/);
    if (m) {
      const s = this['STEP_' + m[3]];
      if (s) {
        this.step_name = name;
        this.step_file = path.join(this.dir, name);
        this.opts.verbose && console.log('Step %d: %s', m[1]/10, m[2]);
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
