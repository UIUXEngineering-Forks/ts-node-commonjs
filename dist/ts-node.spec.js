var chai_1 = require('chai');
var child_process_1 = require('child_process');
var path_1 = require('path');
var proxyquire = require('proxyquire');
var ts_node_1 = require('./ts-node');
var cwd = path_1.join(__dirname, '../src');
var BIN_EXEC = "node " + path_1.join(__dirname, '../dist/bin/ts-node') + " --project \"" + cwd + "\"";
describe('ts-node', function () {
    this.timeout(10000);
    it('should export the correct version', function () {
        chai_1.expect(ts_node_1.VERSION).to.equal(require('../package.json').version);
    });
    describe('cli', function () {
        it('should execute cli', function (done) {
            child_process_1.exec(BIN_EXEC + " tests/hello-world", function (err, stdout) {
                chai_1.expect(err).to.not.exist;
                chai_1.expect(stdout).to.equal('Hello, world!\n');
                return done();
            });
        });
        it('should print scripts', function (done) {
            child_process_1.exec(BIN_EXEC + " -p \"import { example } from './tests/complex/index';example()\"", function (err, stdout) {
                chai_1.expect(err).to.not.exist;
                chai_1.expect(stdout).to.equal('example\n');
                return done();
            });
        });
        it('should eval code', function (done) {
            child_process_1.exec(BIN_EXEC + " -e \"import * as m from './tests/module';console.log(m.example('test'))\"", function (err, stdout) {
                chai_1.expect(err).to.not.exist;
                chai_1.expect(stdout).to.equal('TEST\n');
                return done();
            });
        });
        it('should throw errors', function (done) {
            child_process_1.exec(BIN_EXEC + " -e \"import * as m from './tests/module';console.log(m.example(123))\"", function (err) {
                chai_1.expect(err.message).to.contain('[eval].ts (1,59): Argument of type \'number\' is not assignable to parameter of type \'string\'. (2345)');
                return done();
            });
        });
        it('should be able to ignore errors', function (done) {
            child_process_1.exec(BIN_EXEC + " --ignoreWarnings 2345 -e \"import * as m from './tests/module';console.log(m.example(123))\"", function (err) {
                chai_1.expect(err.message).to.match(/TypeError: (?:(?:undefined|foo\.toUpperCase) is not a function|.*has no method \'toUpperCase\')/);
                return done();
            });
        });
        it('should work with source maps', function (done) {
            child_process_1.exec(BIN_EXEC + " tests/throw", function (err) {
                chai_1.expect(err.message).to.contain([
                    (path_1.join(__dirname, '../tests/throw.ts') + ":3"),
                    '  bar () { throw new Error(\'this is a demo\') }',
                    '                 ^',
                    'Error: this is a demo'
                ].join('\n'));
                return done();
            });
        });
        it('eval should work with source maps', function (done) {
            child_process_1.exec(BIN_EXEC + " -p \"import './tests/throw'\"", function (err) {
                chai_1.expect(err.message).to.contain([
                    (path_1.join(__dirname, '../tests/throw.ts') + ":3"),
                    '  bar () { throw new Error(\'this is a demo\') }',
                    '                 ^',
                    'Error: this is a demo'
                ].join('\n'));
                return done();
            });
        });
        it('should ignore all warnings', function (done) {
            child_process_1.exec(BIN_EXEC + " -d -p \"x\"", function (err) {
                chai_1.expect(err.message).to.contain('ReferenceError: x is not defined');
                return done();
            });
        });
    });
    describe('register', function () {
        ts_node_1.register({ project: cwd });
        it('should be able to require typescript', function () {
            var m = require('../tests/module');
            chai_1.expect(m.example('foo')).to.equal('FOO');
        });
        it('should compile through js and ts', function () {
            var m = require('../tests/complex');
            chai_1.expect(m.example()).to.equal('example');
        });
        it('should work with proxyquire', function () {
            var m = proxyquire('../tests/complex', {
                './example': 'hello'
            });
            chai_1.expect(m.example()).to.equal('hello');
        });
        it('should use source maps', function (done) {
            try {
                require('../tests/throw');
            }
            catch (error) {
                chai_1.expect(error.stack).to.contain([
                    'Error: this is a demo',
                    ("    at Foo.bar (" + path_1.join(__dirname, '../tests/throw.ts') + ":3:18)")
                ].join('\n'));
                done();
            }
        });
    });
});
//# sourceMappingURL=ts-node.spec.js.map