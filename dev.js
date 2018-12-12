const cp = require('child_process');
const run = (cmd) => {
  const child = cp.spawn('npm', ['run', cmd]);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
};

run('build-js');
run('start');
