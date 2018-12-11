const { ipcRenderer } = require('electron');

const createElement = (tagName) => {
  const element = document.createElement(tagName);
  return element;
};

const $menu = createElement('menu');
const $editor = createElement('textarea');

$editor.onkeydown = e => {
  if (e.key === 'Tab') {
    e.preventDefault();

    const { selectionStart, selectionEnd } = $editor;

    $editor.value = $editor.value.slice(0, selectionStart) + '\t' + $editor.value.slice(selectionEnd);

    $editor.selectionStart = $editor.selectionEnd = selectionStart + 1;
  }
};

document.body.appendChild($menu);
document.body.appendChild($editor);

ipcRenderer.on('read', (e, data) => {
  const { contents } = data;
  $editor.value = contents;
});

ipcRenderer.send('files');
ipcRenderer.on('files', (e, { dir, files }) => {
  while ($menu.childNodes.length) {
    $menu.removeChild($menu.firstChild);
  }
  renderFiles($menu, files);
});

function renderFiles (parent, files, depth = 0) {
  for (const file of files) {
    const $file = createElement('file');
    const $filename = createElement('p');
    const $children = createElement('children');

    $filename.textContent = file.name;
    $filename.ondblclick = () => {
      if (file.isDir) {
        ipcRenderer.send('files', { fullpath: file.fullpath, reset: true });
        $menu.scrollTop = 0;
      }
    };
    $filename.onclick = () => {
      if (file.isDir) {
        if (file.name === '..') {
          ipcRenderer.send('files', { fullpath: file.fullpath, reset: true });
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
