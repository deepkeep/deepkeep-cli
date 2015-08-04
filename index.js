var fs = require('fs');
var AdmZip = require('adm-zip');
var FormData = require('form-data');
var read = require("read");
var promzard = require('promzard');
var path = require('path');

var parser = require("nomnom");

parser.command('init')
  .callback(init)
  .help('initializes a new package.json');

parser.command('publish')
  .callback(publish)
  .help('publishes a package to deepkeep');

parser.parse();

function init(opts) {
  var initDialogFile = path.resolve(__dirname, 'init-dialog.js');
  promzard(initDialogFile, {}, function (err, data) {
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

function publish(opts) {
  var packageJson = JSON.parse(fs.readFileSync('package.json'));
  if (!packageJson.name) throw new Error('name required in package.json');
  if (!packageJson.version) throw new Error('version required in package.json');

  var zip = new AdmZip();
  zip.addLocalFile('package.json', 'package.json');
  if (fs.existsSync('README.md'))
    zip.addLocalFile('README.md', 'README.md');
  if (fs.existsSync('network.t7'))
    zip.addLocalFile('network.t7', 'network.t7');
  var packageZip = zip.toBuffer();

  read({prompt:'Username: '}, function(err, username) {
    if (err) process.exit(1);
    read({prompt: 'Password: ', silent: true}, function(err, password) {
      if (err) process.exit(1);

      var form = new FormData();
      form.append('package', packageZip, {
        filename: 'package.zip',
        contentType: 'application/octet-stream',
        knownLength: packageZip.length
      });
      var formOpts = {
        host: opts.host || 'packages.deepkeep.co',
        port: opts.port || 80,
        path: '/v1/upload',
        auth: username + ':' + password
      }

      console.log('Uploading', username + '/' + packageJson.name + '/' + packageJson.version, 'to', formOpts.host + (formOpts.port != 80 ? ':' + formOpts.port : ''));
      form.submit(formOpts, function(err, res) {
        if (err || res.statusCode !== 200) {
          console.log('Failed to upload package', err, res.statusMessage, res.body);
        } else {
          console.log('Successfully uploaded package to deepkeep!');
        }
        res.resume();
      });
    });
  });
}
