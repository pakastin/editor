'use strict';

/* global monaco */
const { ipcRenderer } = require('electron');
const Terminal = require('./js/xterm/xterm.js');
const fit = require('./js/xterm/addons/fit/fit.js');
const path = require('path');

const { localStorage } = window;

const createElement = (tagName) => {
  const element = document.createElement(tagName);
  return element;
};

const $menu = createElement('div');
const $editor = createElement('div');
const $terminal = createElement('div');

let editor;

(() => {
  /* global self */
  const amdLoader = require('./js/vs/loader.js');

  amdLoader.require.config({
    baseUrl: path.join(__dirname, 'js')
  });

  self.module = undefined;

  amdLoader.require(['vs/editor/editor.main'], () => {
    editor = monaco.editor.create($editor, {
      scrollBeyondLastLine: false,
      lineNumbersMinChars: 4,
      fontFamily: 'SFMono-Regular,Consolas,Liberation Mono,Menlo,Courier,monospace',
      fontSize: 14,
      lineHeight: 21,
      letterSpacing: -0.5,
      minimap: {
        enabled: false
      },
      renderLineHighlight: 'all'
    });
  });
})();

$menu.id = 'menu';
$editor.id = 'editor';
$terminal.id = 'terminal';

document.body.appendChild($menu);
document.body.appendChild($editor);
document.body.appendChild($terminal);

Terminal.applyAddon(fit);
const term = new Terminal({
  fontFamily: 'SFMono-Regular,Consolas,Liberation Mono,Menlo,Courier,monospace',
  fontSize: 14,
  fontWeight: 600,
  theme: {
    cursor: '#ff00ff'
  }
});

term.open($terminal);
term.fit();

const os = require('os');
const pty = require('node-pty');

const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];

const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: term.cols,
  rows: term.rows,
  cwd: process.cwd(),
  env: process.env
});

ptyProcess.write('export PS1="\\n \\w "\nclear\n');

term.on('data', data => ptyProcess.write(data));
ptyProcess.on('data', data => term.write(data));

window.addEventListener('resize', () => {
  editor.layout();
  term.fit();
  ptyProcess.resize(term.cols, term.rows);
});

ipcRenderer.on('read', (e, data) => {
  const { contents } = data;
  const oldModel = editor.getModel();
  const newModel = monaco.editor.createModel(contents);

  editor.setModel(newModel);

  if (oldModel) {
    oldModel.dispose();
  }
});

ipcRenderer.send('files');
ipcRenderer.on('files', (e, { dir, files, reset }) => {
  while ($menu.childNodes.length) {
    $menu.removeChild($menu.firstChild);
  }
  renderFiles($menu, files);

  if (reset) {
    ptyProcess.write(`cd ${dir}\n`);
    ptyProcess.write('clear\n');
  }
});

const currentDir = localStorage.getItem('currentDir');

if (currentDir) {
  ipcRenderer.send('files', { fullpath: currentDir, reset: true });
}

function renderFiles (parent, files, depth = 0) {
  for (const file of files) {
    const $file = createElement('div');
    const $filename = createElement('p');
    const $children = createElement('children');

    $file.className = 'file';

    $filename.textContent = file.name;
    $filename.ondblclick = () => {
      if (file.isDir && file.name !== '..') {
        ipcRenderer.send('files', { fullpath: file.fullpath, reset: true });
        $menu.scrollTop = 0;
        localStorage.setItem('currentDir', file.fullpath);
      }
    };
    $filename.onclick = () => {
      if (file.isDir) {
        if (file.name === '..') {
          ipcRenderer.send('files', { fullpath: file.fullpath, reset: true });
          localStorage.setItem('currentDir', file.fullpath);
        } else {
          ipcRenderer.send('files', { fullpath: file.fullpath });
        }
      } else {
        ipcRenderer.send('read', { fullpath: file.fullpath });
      }
    };

    if (file.isDir) {
      $filename.classList.add('dir');
    } else {
      $filename.classList.remove('dir');
    }

    $filename.style.marginLeft = `${depth * 0.625}rem`;

    if (file.children) {
      renderFiles($children, file.children, depth + 1);
    }

    $file.appendChild($filename);
    $file.appendChild($children);
    parent.appendChild($file);
  }
}
