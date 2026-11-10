'use strict';
const base = 'https://github.com/dschwen/AMOScript/blob/master/demos/';
const github = file => base + file;
const preview = file => {
  if (!file.endsWith('.html')) throw Error('HTML Preview requires an HTML demo: ' + file);
  return 'https://htmlpreview.github.io/?' + github(file);
};
const destination = file => file.endsWith('.md') ? github(file) : preview(file);
const text = value => String(value).replace(/[\\`*_[\]<>|]/g, c => '\\' + c).replace(/[\r\n]+/g, ' ');
const link = (label, target) => `[${text(label)}](${target})`;
module.exports = { github, preview, destination, text, link };
