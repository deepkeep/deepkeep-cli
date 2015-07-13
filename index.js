var fs = require('fs');
var AdmZip = require('adm-zip');

var read = require("read");
var promzard = require('promzard');
var path = require('path');
var promptFile = path.resolve(__dirname, 'prompt.js');

var parser = require("nomnom");

parser.command('init')
   .callback(init)
   .help('initializes a new package.json');

parser.command('zip')
   .option('outfile', {
      abbr: 'o',
      default: 'package.zip',
      help: 'name of the zip file to write to'
   })
   .callback(zip)
   .help('zip the current project for publishing')

parser.parse();

function init() {
  promzard(promptFile, {}, function (err, data) {
    if (err) throw new Error(err);

    var packageJson = path.join(__dirname, 'package.json');
    var d = JSON.stringify(data, null, 2) + '\n'

    console.log('About to write to %s:\n\n%s\n', packageJson, d)
    read({prompt:'Is this ok? ', default: 'yes'}, function (err, ok) {
      if (!ok || ok.toLowerCase().charAt(0) !== 'y') {
        console.log('Aborted.')
      } else {
        fs.writeFile(packageJson, d, 'utf8', function (err) {
          if (err) {
            console.log('Failed to write package.json', err);
            process.exit(1);
          }
        });
      }
    })
  });
}

function zip() {
  var packageJson = path.join(__dirname, 'package.json');
  fs.readFile(packageJson, function(err, data) {
    if (err) {
      console.log('Failed to read ' + packageJson, err);
      process.exit(1);
    }

    var packageModel = JSON.parse(data);
    if (!packageModel.model) {
      console.log('"model" is undefined in ' + packageJson + ' but required');
      process.exit(1);
    }

    var modelPath = path.join(__dirname, packageModel.model);
    console.log('modelPath', modelPath);
    fs.exists(modelPath, function(exists) {
      console.log('exists', exists);
      if (!exists) {
        console.log(modelPath + ' does not exist, but is required');
        process.exit(1);
      }
      var zip = new AdmZip();
      zip.addLocalFile(packageJson);
      zip.addLocalFile(modelPath);
      // TODO falcon: add readme or should we just package the whole directory?
      zip.writeZip('package.' + packageModel.version + '.zip');
    });
  });
}

function publish() {
  console.log('not implemented');
  process.exit(1);
}
