var fs = require('fs');
var archiver = require('archiver');
var promisify = require('es6-promisify');
var read = promisify(require('read'));
var promzard = require('promzard');
var path = require('path');
var parser = require('nomnom');
var http = require('http');
var httpFR = require('follow-redirects').http;
var streamToBuffer = require('stream-to-buffer');
var unzip = require('unzip');

parser.command('init')
  .callback(init)
  .help('initializes a new package.json');

parser.command('publish')
  .callback(publish)
  .help('publishes a package to deepkeep');

parser.command('install')
  .callback(install)
  .options({
      package: {
         position: 1,
         help: 'package to install',
         required: true
      }
   })
  .help('installs a network locally');

parser.parse();

function init(opts) {
  var initDialogFile = path.resolve(__dirname, 'init-dialog.js');
  promzard(initDialogFile, {}, function (err, data) {
    if (err) throw new Error(err);

    var packageJson = path.resolve('package.json');
    var d = JSON.stringify(data, null, 2) + '\n'

    console.log('About to write to %s:\n\n%s\n', packageJson, d)
    read({prompt:'Is this ok? ', default: 'yes'}, function (err, ok) {
      if (!ok || ok.toLowerCase().charAt(0) !== 'y') {
        console.log('Aborted.')
      } else {
        fs.writeFileSync(packageJson, d, 'utf8');
      }
    })
  });
}

function getUsernamePassword(opts) {
  var username = Promise.resolve(opts.username);
  if (!opts.username) username = read({ prompt: 'Username: ' });
  return username.then(function(usr) {
    var password = Promise.resolve(opts.password);
    if (!opts.password) password = read({ prompt: 'Password: ', silent: true });
    return password.then(function(pass) {
      return {
        username: usr,
        password: pass
      };
    });
  });
}

function logResError(res) {
  console.log('Http error:', res.statusCode);
  streamToBuffer(res, function(err, body) {
    console.log(body.toString());
  });
}

function publish(opts) {
  var packageJson = JSON.parse(fs.readFileSync('package.json'));
  if (!packageJson.name) throw new Error('name required in package.json');
  if (!packageJson.version) throw new Error('version required in package.json');

  var archive = archiver.create('zip', {});
  archive.append(fs.createReadStream('package.json'), { name: 'package.json' });
  if (fs.existsSync('README.md'))
    archive.append(fs.createReadStream('README.md'), { name: 'README.md' });
  if (fs.existsSync('network.t7'))
    archive.append(fs.createReadStream('network.t7'), { name: 'network.t7' });
  archive.finalize();

  getUsernamePassword(opts).then(function(auth) {

    var packageId = auth.username + '/' + packageJson.name + '/' + packageJson.version;
    var reqopts = {
      method: 'PUT',
      hostname: opts.host || 'packages.deepkeep.co',
      port: opts.port || 80,
      path: '/v1/' + packageId + '/package.zip',
      auth: auth.username + ':' + auth.password
    };

    console.log('Uploading', packageId, 'to', reqopts.hostname + (reqopts.port !== 80 ? ':' + reqopts.port : ''));
    var req = http.request(reqopts, function(res) {
      if (res.statusCode !== 200) {
        return logResError(res);
      }
      console.log('Successfully uploaded package to deepkeep!');
    });

    req.on('error', function(e) {
      console.log('Failed to upload: ' + e.message);
    });

    archive.pipe(req);
  }).catch(function(err) {
    console.log('Failed to get username/password', err.stack);
  });
}

function install(opts) {
  console.log('Installing ' + opts.package);
  var reqopts = {
    method: 'GET',
    hostname: opts.host || 'packages.deepkeep.co',
    port: opts.port || 80,
    path: '/v1/' + opts.package + '/_latest/package.zip',
  }
  httpFR.request(reqopts, function(res) {
    if (res.statusCode !== 200) {
      return logResError(res);
    }
    res.pipe(unzip.Extract({ path: opts.package }));
    res.on('end', function() {
      console.log('Package successfully installed!');
    });
  }).end();
}
