var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var tsconfig = require('tsconfig');
var path_1 = require('path');
var fs_1 = require('fs');
var os_1 = require('os');
var sourceMapSupport = require('source-map-support');
var extend = require('xtend');
var arrify = require('arrify');
var chalk = require('chalk');
var make_error_1 = require('make-error');
exports.VERSION = '0.5.3';
exports.EXTENSIONS = ['.ts', '.tsx'];
function readConfig(options, cwd, ts) {
    var project = options.project, noProject = options.noProject;
    var fileName = noProject ? undefined : tsconfig.resolveSync(project || cwd);
    var config = fileName ? tsconfig.readFileSync(fileName, { filterDefinitions: true }) : {
        files: [],
        compilerOptions: {}
    };
    config.compilerOptions = extend(config.compilerOptions, {
        rootDir: cwd,
        sourceMap: true,
        inlineSourceMap: false,
        inlineSources: false,
        declaration: false
    }, {
        target: 'es5',
        module: 'commonjs'
    });
    if (typeof ts.parseConfigFile === 'function') {
        return ts.parseConfigFile(config, ts.sys, fileName);
    }
    return ts.parseJsonConfigFileContent(config, ts.sys, fileName);
}
function register(opts) {
    var cwd = process.cwd();
    var options = extend({ getFile: getFile, getVersion: getVersion, project: cwd }, opts);
    var files = {};
    options.compiler = options.compiler || 'typescript';
    options.ignoreWarnings = arrify(options.ignoreWarnings).map(Number);
    var ts = require(options.compiler);
    var config = readConfig(options, cwd, ts);
    if (!options.disableWarnings && config.errors.length) {
        var diagnostics = config.errors.map(function (d) { return formatDiagnostic(d, ts); });
        console.error(printDiagnostics(diagnostics));
        process.exit(1);
    }
    for (var _i = 0, _a = config.fileNames; _i < _a.length; _i++) {
        var fileName = _a[_i];
        files[fileName] = true;
    }
    var serviceHost = {
        getScriptFileNames: function () { return Object.keys(files); },
        getScriptVersion: options.getVersion,
        getScriptSnapshot: function (fileName) {
            var contents = options.getFile(fileName);
            return contents == null ? undefined : ts.ScriptSnapshot.fromString(contents);
        },
        getNewLine: function () { return os_1.EOL; },
        getCurrentDirectory: function () { return cwd; },
        getCompilationSettings: function () { return config.options; },
        getDefaultLibFileName: function (options) { return ts.getDefaultLibFilePath(config.options); }
    };
    var service = ts.createLanguageService(serviceHost);
    sourceMapSupport.install({
        retrieveSourceMap: function (fileName) {
            if (files[fileName]) {
                return {
                    url: fileName,
                    map: retrieveSourceMap(fileName)
                };
            }
        }
    });
    function retrieveSourceMap(fileName) {
        var output = service.getEmitOutput(fileName);
        var sourceText = service.getSourceFile(fileName).text;
        var sourceMap = output.outputFiles[0].text;
        return getSourceMap(sourceMap, fileName, sourceText);
    }
    function addFileName(fileName) {
        files[fileName] = true;
    }
    function compile(fileName) {
        addFileName(fileName);
        var output = service.getEmitOutput(fileName);
        var diagnostics = getDiagnostics(service, fileName, options, ts);
        if (output.emitSkipped) {
            diagnostics.push(path_1.relative(cwd, fileName) + ": Emit skipped");
        }
        if (diagnostics.length) {
            if (options.isEval) {
                throw new TSError(diagnostics);
            }
            else {
                console.error(printDiagnostics(diagnostics));
                process.exit(1);
            }
        }
        return output.outputFiles[1].text;
    }
    function loader(m, fileName) {
        return m._compile(compile(fileName), fileName);
    }
    function getTypeInfo(fileName, position) {
        addFileName(fileName);
        var info = service.getQuickInfoAtPosition(fileName, position);
        var name = ts.displayPartsToString(info ? info.displayParts : []);
        var comment = ts.displayPartsToString(info ? info.documentation : []);
        return chalk.bold(name) + (comment ? "" + os_1.EOL + comment : '');
    }
    exports.EXTENSIONS.forEach(function (extension) {
        require.extensions[extension] = loader;
    });
    return { compile: compile, getTypeInfo: getTypeInfo };
}
exports.register = register;
function getVersion(fileName) {
    return String(fs_1.statSync(fileName).mtime.getTime());
}
exports.getVersion = getVersion;
function getFile(fileName) {
    try {
        return fs_1.readFileSync(fileName, 'utf8');
    }
    catch (err) { }
}
exports.getFile = getFile;
function getDiagnostics(service, fileName, options, ts) {
    if (options.disableWarnings) {
        return [];
    }
    return ts.getPreEmitDiagnostics(service.getProgram())
        .filter(function (diagnostic) {
        return options.ignoreWarnings.indexOf(diagnostic.code) === -1;
    })
        .map(function (diagnostic) {
        return formatDiagnostic(diagnostic, ts);
    });
}
function formatDiagnostic(diagnostic, ts, cwd) {
    if (cwd === void 0) { cwd = '.'; }
    var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.file) {
        var path = path_1.relative(cwd, diagnostic.file.fileName);
        var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
        return path + " (" + (line + 1) + "," + (character + 1) + "): " + message + " (" + diagnostic.code + ")";
    }
    return message + " (" + diagnostic.code + ")";
}
function printDiagnostics(diagnostics) {
    var boundary = chalk.grey('----------------------------------');
    return [
        boundary,
        chalk.red.bold('⨯ Unable to compile TypeScript'),
        '',
        diagnostics.join(os_1.EOL),
        boundary
    ].join(os_1.EOL);
}
exports.printDiagnostics = printDiagnostics;
function getSourceMap(map, fileName, code) {
    var sourceMap = JSON.parse(map);
    sourceMap.file = fileName;
    sourceMap.sources = [fileName];
    sourceMap.sourcesContent = [code];
    delete sourceMap.sourceRoot;
    return JSON.stringify(sourceMap);
}
var TSError = (function (_super) {
    __extends(TSError, _super);
    function TSError(diagnostics) {
        _super.call(this, 'Unable to compile TypeScript');
        this.diagnostics = diagnostics;
        this.name = 'TSError';
    }
    TSError.prototype.print = function () {
        return printDiagnostics(this.diagnostics);
    };
    return TSError;
})(make_error_1.BaseError);
exports.TSError = TSError;
//# sourceMappingURL=ts-node.js.map