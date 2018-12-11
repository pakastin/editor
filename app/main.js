const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const state = {
  files: [],
  fullpathLookup: {}
};

function createWindow () {
  const win = new BrowserWindow();

  win.loadFile('index.html');
}

app.on('ready', createWindow);

ipcMain.on('read', async (e, data) => {
  const { fullpath } = data || {};

  const stats = await stat(fullpath);

  if (stats.size > 100000000) {
    e.sender.send('read', {
      fullpath,
      contents: 'FILE TOO BIG'
    });
    return;
  }

  const contents = await readFile(fullpath, { encoding: 'utf8' });

  e.sender.send('read', {
    fullpath,
    contents
  });
});

ipcMain.on('files', async (e, data) => {
  const { fullpath, reset } = data || {};
  const home = app.getPath('home');
  const dir = fullpath || home;
  const parsed = path.parse(dir);

  if (reset || !data) {
    if (parsed.root !== parsed.dir) {
      state.files = [{
        name: '..',
        fullpath: path.resolve(dir, '..'),
        isDir: true
      }];
    } else {
      state.files = [];
    }
    state.fullpathLookup = {};
  }

  if (state.fullpathLookup[dir] && state.fullpathLookup[dir].children) {
    // close dir
    state.fullpathLookup[dir].children = null;

    e.sender.send('files', {
      dir,
      files: state.files
    });
    return;
  }

  const files = await readdir(dir).then(files => {
    return Promise.all(files.map(async file => {
      const stats = await stat(path.join(dir, file));

      return {
        name: file,
        fullpath: path.join(dir, file),
        isDir: stats.isDirectory()
      };
    }));
  });

  files.forEach(file => {
    state.fullpathLookup[file.fullpath] = file;
  });

  files.sort((a, b) => {
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  if (state.fullpathLookup[dir]) {
    // open dir
    state.fullpathLookup[dir].children = files.filter(file => file.isDir).concat(files.filter(file => !file.isDir));

    e.sender.send('files', {
      dir,
      files: state.files
    });
    return;
  }

  Array.prototype.push.apply(state.files, files.filter(file => file.isDir).concat(files.filter(file => !file.isDir)));

  e.sender.send('files', {
    dir,
    files: state.files
  });
});
