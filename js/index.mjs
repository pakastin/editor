/* global monaco */
const { ipcRenderer } = require('electron');
const path = require('path');

const { localStorage } = window;

const createElement = (tagName) => {
  const element = document.createElement(tagName);
  return element;
};

const $menu = createElement('div');
const $editor = createElement('div');

let editor;

(() => {
  /* global self */
  const amdLoader = require('./js/vs/loader.js');

  console.log(__dirname);

  amdLoader.require.config({
    baseUrl: path.join(__dirname, 'js')
  });

  self.module = undefined;

  amdLoader.require(['vs/editor/editor.main'], () => {
    editor = monaco.editor.create($editor, {
      scrollBeyondLastLine: false,
      minimap: {
        enabled: false
      }
    });
  });
})();

$menu.id = 'menu';
$editor.id = 'editor';

document.body.appendChild($menu);
document.body.appendChild($editor);

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
ipcRenderer.on('files', (e, { dir, files }) => {
  while ($menu.childNodes.length) {
    $menu.removeChild($menu.firstChild);
  }
  renderFiles($menu, files);
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
