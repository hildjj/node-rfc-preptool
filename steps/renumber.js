const fs = require('fs');

fs.readdir(__dirname, (er, contents) => {
  if (er) {
    console.error(er);
    return;
  }
  contents.sort();
  var n = 10;
  contents.forEach(f => {
    const m = f.match(/^[0-9]+_(.*)$/);
    if (m) {
      const o = ("00" + n).slice(-4);
      fs.renameSync(f, o + "_" + m[1]);
      n += 10;
    }
  });
});
