'use strict';

var api = require('../../api');
var chalk = require('chalk');
var RSVP = require('rsvp');
var tmp = require('tmp');
var utils = require('../../utils');
var prepareFunctionsUpload = require('../../prepareFunctionsUpload');

tmp.setGracefulCleanup();

module.exports = function(context, options, payload) {
  var _uploadSource = function(source) {
    var versionId = options.firebaseRef.push().key();
    return api.request('PUT', '/v1/projects/' + encodeURIComponent(context.projectId) + '/functions/uploads/' + versionId, {
      auth: true,
      files: {
        code: {
          filename: 'source.zip',
          stream: source.stream,
          contentType: 'application/zip',
          knownLength: source.size
        }
      },
      origin: api.deployOrigin
    });
  };

  var _isBillingEnabled = function() {
    return api.request('GET', '/v1/projects/' + encodeURIComponent(context.projectId) + '/billingInfo', {
      auth: true,
      origin: api.billingOrigin
    }).then(function(response) {
      return response.body.billingEnabled;
    });
  };

  if (options.config.get('functions')) {
    utils.logBullet(chalk.cyan.bold('functions:') + ' preparing ' + chalk.bold(options.config.get('functions.source')) + ' directory for uploading...');

    return _isBillingEnabled().then(function(enabled) {
      if (!enabled) {
        return utils.reject('Firebase Functions is only available to Firebase apps on a paid plan. '
        + 'Please upgrade your project to a paid plan using the Firebase Console: '
        + 'https://console.firebase.google.com/project/' + context.projectId + '/overview');
      }
      return prepareFunctionsUpload(options);
    })
    .then(function(result) {
      payload.functions = {
        triggers: options.config.get('functions.triggers')
      };

      if (!result) {
        utils.logWarning(chalk.cyan.bold('functions:') + ' no triggers defined, skipping deploy.');
        return undefined;
      }
      return _uploadSource(result).then(function() {
        utils.logSuccess(chalk.green.bold('functions:') + ' ' + chalk.bold(options.config.get('functions.source')) + ' folder uploaded successfully');
      });
    });
  }

  return RSVP.resolve();
};
