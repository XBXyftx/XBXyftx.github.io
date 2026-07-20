/* global marked */
importScripts('../marked.min.js');

marked.setOptions({ gfm: true, breaks: true, headerIds: false, mangle: false });

self.onmessage = ({ data }) => {
  const { version, markdown } = data;
  try {
    self.postMessage({ version, html: marked.parse(markdown) });
  } catch (error) {
    self.postMessage({ version, error: error.message || 'Markdown 解析失败。' });
  }
};
