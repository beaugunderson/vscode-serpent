'use strict';

const LanguageClient = require('vscode-languageclient').LanguageClient;
const path = require('path');

exports.activate = (context) => {
  const serverModule = path.join(__dirname, 'server.js');

  const client = new LanguageClient('serpent', {
    run: {
      module: serverModule
    },
    debug: {
      module: serverModule,
      options: {
        execArgv: ['--nolazy', '--debug=6004']
      }
    },
    outputChannelName: 'Serpent Language Server'
  }, {
    documentSelector: ['serpent']
  });

  context.subscriptions.push(client.start());
};
