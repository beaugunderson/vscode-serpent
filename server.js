'use strict';

const languageServer = require('vscode-languageserver');
const Files = languageServer.Files;

const connection = languageServer.createConnection(process.stdin, process.stdout);
const documents = new languageServer.TextDocuments();

const util = require('util');
const exec = util.promisify(require('child_process').exec);

const RE_LINE = /^(.+?):(\d+):(\d+) ([EW])\d+ (.+)$/;

function matchToDiagnostic(match) {
  matchProperties = {
    completeMatch: match[0],
    filepath: match[1],
    line: parseInt(match[2]),
    column: parseInt(match[3]),
    severityKey: match[4],
    message: match[5]
  };

  let severity = matchProperties.severityKey === 'W' ?
    languageServer.DiagnosticSeverity.Warning :
    languageServer.DiagnosticSeverity.Error;

  // let quote = null;

  // // check for variable name or line in message
  // if (matchProperties.message.indexOf('"') !== -1) {
  //   quote = matchProperties.message.match(/\\?"(.*?)\\?"/)[1];
  // } else if (matchProperties.message.indexOf("'") !== -1) {
  //   quote = matchProperties.message.match(/'(.*)'/)[1];
  // }

  let lineNumber = matchProperties.line;

  let colStart = matchProperties.column;
  let colEnd = matchProperties.column;

  // let colEnd = this._documentText[lineNumber].length;
  // let documentLine: string = this._documentText[lineNumber];

  // make sure colStart does not including leading whitespace
  // if (colStart == 0 && documentLine.substr(0, 1).match(/\s/) !== null) {
  //   colStart = documentLine.length - documentLine.replace(/^\s*/g, "").length;
  // }

  return {
    severity: severity,
    range: {
      start: {
        line: lineNumber,
        character: colStart
      },
      end: {
        line: lineNumber,
        character: colEnd
      }
    },
    message: matchProperties.severityKey + ": " + matchProperties.message
  };

function serplint(filePath) {
  return new Promise((resolve, reject) => {
    exec(`serplint "${filePath}"`)
      .then((err, stdout) => {
        if (err) {
          return reject(err);
        }

        const diagnostics = stdout.split(/\n/g).map((line) => {
          let match = RE_LINE.match(line);

          if (match) {
            return matchToDiagnostic(match);
          }
        });

        resolve(diagnostics);
      }).catch(reject);
  });
}

function validate(document) {
  const filePath = Files.uriToFilePath(document.uri);

  return serplint(filePath)
    .then(diagnostics => {
      connection.sendDiagnostics({
        uri: document.uri,
        diagnostics
      });
    })
    .catch(err => {
      if (err.reasons) {
        return err.reasons
          .forEach(reason => connection.window.showErrorMessage('serplint: ' + reason));
      }

      connection.window.showErrorMessage(err.stack.replace(/\n/g, ' '));
    });
}

function validateAll() {
  return Promise.all(documents.all().map(document => validate(document)));
}

connection.onInitialize(() => {
  validateAll();

  return {
    capabilities: {
      textDocumentSync: documents.syncKind
    }
  };
});

connection.onDidChangeConfiguration(() => validateAll());
connection.onDidChangeWatchedFiles(() => validateAll());
documents.onDidChangeContent(event => validate(event.document));

documents.onDidClose(event => connection.sendDiagnostics({
  uri: event.document.uri,
  diagnostics: []
}));

documents.listen(connection);

connection.listen();
