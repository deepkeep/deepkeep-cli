var fs = require('fs');
var path = require('path');
module.exports = {
  name: prompt('name', path.basename(__dirname)),
  version: prompt('version', '0.0.0')
}
