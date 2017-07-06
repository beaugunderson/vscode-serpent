'use strict';

const exec = require('child_process').exec;
const languageServer = require('vscode-languageserver');
const Files = languageServer.Files;

const connection = languageServer.createConnection(process.stdin, process.stdout);
const documents = new languageServer.TextDocuments();

const RE_LINE = /^(.+?):(\d+):(\d+) ([EW])\d+ (.+)$/;

function matchToDiagnostic(match) {
  let item = {
    completeMatch: match[0],
    filepath: match[1],
    line: parseInt(match[2], 10) - 1,
    column: parseInt(match[3], 10) - 1,
    severityKey: match[4],
    message: match[5]
  };

  let severity = item.severityKey === 'W' ?
    languageServer.DiagnosticSeverity.Warning :
    languageServer.DiagnosticSeverity.Error;

  return {
    severity: severity,
    range: {
      start: {
        line: item.line,
        character: item.column
      },
      end: {
        line: item.line,
        character: item.column
      }
    },
    message: `${item.severityKey}: ${item.message}`
  };
}

function serplint(filePath) {
  return new Promise((resolve, reject) => {
    exec(`serplint "${filePath}"`, (err, stdout) => {
      if (err) {
        return reject(err);
      }

      const diagnostics = stdout.split(/\n/g)
        .map((line) => {
          if (!line) {
            return;
          }

          let match = RE_LINE.exec(line);

          if (match) {
            return matchToDiagnostic(match);
          }
        })
        .filter(diagnostic => diagnostic);

      resolve(diagnostics);
    });
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
      connection.window.showErrorMessage(
        err + ' ' + err.stack.replace(/\n/g, ' '));
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
documents.onDidChangeContent(event => validate(event.document));

documents.onDidClose(event => connection.sendDiagnostics({
  uri: event.document.uri,
  diagnostics: []
}));

documents.listen(connection);

connection.listen();
