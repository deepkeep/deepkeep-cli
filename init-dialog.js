var fs = require('fs');
var path = require('path');
module.exports = {
  name: prompt('name', path.basename(path.resolve('.'))),
  version: prompt('version', '0.0.0')
}
