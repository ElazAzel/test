const handler = require('../backend/src/index.js');

module.exports = (req, res) => {
  req.url = req.url.replace(/^\/api/, '') || '/';
  handler(req, res);
};
