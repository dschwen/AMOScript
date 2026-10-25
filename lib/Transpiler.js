/* jshint esversion: 6 */
'use strict';

const BufferReader = require('./Buffer');
const Parser = require('./Parser');
const BankReader = require('./BankReader');
const BankWriter = require('./BankWriter');
const Lowerer = require('./Lowerer');
const { createProgram } = require('./amos/driver');
const createOperations = require('./amos/operations');
const createAudio = require('./amos/audio');
const readMod = require('./amos/mod');
const createTracker = require('./amos/tracker');
const createBankMemory = require('./amos/bankMemory');
const { createIlbmReader } = require('./display/model/ilbm');
const createDisplay = require('./amos/display');
const createFont = require('./amos/font');
const ChipMemory = require('./display/model/ChipMemory');
const { createFrameStateModel } = require('./display/model/frameState');
const staticFrame = require('./display/model/staticFrame');
const createPhysicalBridge = require('./display/model/physicalBridge');
const { createReferenceRenderer } = require('./display/reference/render');
const { createSpriteModel } = require('./display/reference/sprites');
const { createColorModel } = require('./display/model/color');
const { createRegisterModel } = require('./display/model/registers');
const { createCopperBuilder } = require('./display/copper/builder');
const { createCopperInterpreter } = require('./display/copper/interpreter');
const { createSpriteDmaFactory } = require('./display/copper/spriteDma');

class Transpiler {
  constructor(data) {
    this._buffer = new BufferReader(new Uint8Array(data));
    this.banks = new BankReader(this._buffer).read();
    this.ast = new Parser(this._buffer).parse();
    const lowered = new Lowerer().lower(this.ast);
    this._ops = lowered.ops;
    this._labels = lowered.labels;
    this._variables = lowered.variables;
    this._procedures = lowered.procedures;
    this._dataScopes = lowered.dataScopes;
    this._variableBufferBytes = lowered.variableBufferBytes;
    this._stackEntries = lowered.stackEntries;
  }

  toModule() {
    const cases = this._ops.map((op, i) => {
      let body;
      switch (op.kind) {
        case 'display': body = `program.${op.target === 'program' ? '' : 'display.'}${op.method}(${op.args.join(', ')}); return {};`; break;
        case 'print': body = op.channel == null ? `program.print([${op.expr}], ${JSON.stringify(op.separators)}); return {};` : `program.filePrint(${op.channel}, [${op.expr}], ${JSON.stringify(op.separators)}); return {};`; break;
        case 'file_open': body = `program.fileOpen(${op.channel}, ${op.filename}, ${JSON.stringify(op.mode)}); return {};`; break;
        case 'file_close': body = `program.fileClose(${op.channel == null ? 'null' : op.channel}); return {};`; break;
        case 'assign': body = op.indices ? `const array = ${op.target}; const indices = [${op.indices.join(', ')}]; program.arrayIndex(array, indices); program.arraySet(array, indices, ${op.expr}); return {};` : `${op.target} = (${op.expr}); return {};`; break;
        case 'substring_assign': {
          // Snapshot the lvalue before bounds/RHS evaluation. Strings are
          // immutable, matching RInMid's copy before overwriting shared data.
          const target = op.indices ? 'current' : op.target;
          const expr = `program.replaceSubstring(${JSON.stringify(op.name)}, ${target}, [${op.args.join(', ')}], () => (${op.expr}))`;
          body = op.indices ? `const array = ${op.target}; const indices = [${op.indices.join(', ')}]; const current = program.arrayGet(array, indices); program.arraySet(array, indices, ${expr}); return {};` : `${op.target} = ${expr}; return {};`;
          break;
        }
        case 'dim': body = `if (${op.target} !== null) throw new Error('Array already dimensioned'); ${op.target} = program.dim([${op.dimensions.join(', ')}], ${JSON.stringify(op.type)}); return {};`; break;
        case 'array_inc': body = `const array = ${op.target}; const indices = [${op.indices.join(', ')}]; program.arraySet(array, indices, (program.arrayGet(array, indices) + (${op.delta})) | 0); return {};`; break;
        case 'restore': body = `state.data.index = ${op.index}; return {};`; break;
        case 'branch_false': body = `return (${op.cond}) ? {} : { goto: ${this._labels[op.label]} };`; break;
        case 'goto': body = `return { goto: ${this._labels[op.label]} };`; break;
        case 'gosub': body = `return { call: ${this._labels[op.label]} };`; break;
        case 'on_branch':
          body = `const selector = ${op.expr}; const targets = ${JSON.stringify(op.labels.map(label => this._labels[label]))}; return selector >= 1 && selector <= targets.length ? { ${op.branch === 'Gosub' ? 'call' : 'goto'}: targets[selector - 1] } : {};`;
          break;
        case 'return': body = 'return { ret: true };'; break;
        case 'end': body = 'return { halt: true };'; break;
        case 'sleep': body = `return { sleepVbl: ${op.expr} };`; break;
        case 'wait_key': body = 'return { waitKey: true };'; break;
        case 'exit':
          body = `${op.condition ? `if (!(${op.condition})) return {}; ` : ''}const level = ${op.expr}; const targets = ${JSON.stringify(op.labels.map(label => this._labels[label]))}; if (!Number.isInteger(level) || level < 1 || level > targets.length) throw new Error('Invalid Exit level'); return { goto: targets[level - 1] };`;
          break;
        case 'proc_call': {
          const info = this._procedures.get(op.procedure);
          const defaults = Object.fromEntries(Array.from(info.locals, ([name, value]) => [name, JSON.parse(value)]));
          body = `return { procCall: ${this._labels[op.label]}, defaults: ${JSON.stringify(defaults)}, parameters: ${JSON.stringify(info.parameters)}, args: [${op.args.join(', ')}], data: dataTables[${JSON.stringify(op.procedure)}] };`;
          break;
        }
        case 'proc_return': body = `return { procReturn: true${op.expr != null ? `, result: ${op.expr}, resultType: ${JSON.stringify(op.type)}` : ''} };`; break;
        default: throw new Error(`Unsupported IR operation ${op.kind}`);
      }
      return `    cases[${i}] = function(state){ state.location = ${JSON.stringify(op.location)}; ${body} };`;
    });
    return [
      '/* Auto-generated by amoscript */',
      '(function(root, factory){',
      "  if (typeof module === 'object' && module.exports) module.exports = factory();",
      '  else root.AMOS_MODULE = factory();',
      "})(typeof globalThis !== 'undefined' ? globalThis : this, function(){",
      `  const fontFactory = ${createFont.toString()};`,
      `  const chipMemoryClass = ${ChipMemory.toString()};`,
      `  const frameStateModel = (${createFrameStateModel.toString()})();`,
      `  const staticFrameFactory = ${staticFrame.toString()};`,
      `  const ilbmReaderFactory = (${createIlbmReader.toString()})(chipMemoryClass, frameStateModel, staticFrameFactory);`,
      `  const planarBridgeFactory = ${createPhysicalBridge.toString()};`,
      `  const colorModel = (${createColorModel.toString()})();`,
      `  const spriteModel = (${createSpriteModel.toString()})();`,
      `  const referenceRenderer = (${createReferenceRenderer.toString()})(frameStateModel, colorModel, spriteModel);`,
      `  const copperRegisters = (${createRegisterModel.toString()})();`,
      `  const copperBuilder = (${createCopperBuilder.toString()})(copperRegisters);`,
      `  const spriteDmaFactory = (${createSpriteDmaFactory.toString()})(copperRegisters);`,
      `  const copperInterpreter = (${createCopperInterpreter.toString()})(frameStateModel, copperRegisters, spriteDmaFactory);`,
      `  const displayFactory = ${createDisplay.toString()};`,
      `  const bankReaderFactory = ${BankReader.toString()};`,
      `  const bankWriterFactory = ${BankWriter.toString()};`,
      `  const operationsFactory = ${createOperations.toString()};`,
      `  const audioFactory = ${createAudio.toString()};`,
      `  const modReaderFactory = ${readMod.toString()};`,
      `  const trackerFactory = ${createTracker.toString()};`,
      `  const bankMemoryFactory = ${createBankMemory.toString()};`,
      `  const createProgram = ${createProgram.toString()};`,
      '  return function create(opts = {}){',
      '    const cases = [];',
      ...Array.from(this._variables, ([name, value]) => `    let ${name} = ${value};`),
      '    const dataTables = Object.create(null);',
      ...Array.from(this._dataScopes, ([name, table]) => `    dataTables[${JSON.stringify(name)}] = [${table.entries.map(entry => `{ type: ${JSON.stringify(entry.type)}, read: state => (${entry.expr == null ? 'null' : entry.expr}), location: ${JSON.stringify(entry.location)} }`).join(', ')}];`),
      ...cases,
      `    const program = createProgram(cases, Object.assign({}, opts, { banks: ${JSON.stringify(this.banks)} }));`,
      `    program.compilation = Object.freeze({ variableBufferBytes: ${JSON.stringify(this._variableBufferBytes)}, stackEntries: ${JSON.stringify(this._stackEntries)} });`,
      '    program.state.data = { entries: dataTables["@main"], index: 0 };',
      '    program.state.variables = Object.create(null);',
      ...Array.from(this._variables.keys(), name => `    Object.defineProperty(program.state.variables, ${JSON.stringify(name)}, { enumerable: true, get: () => ${name} });`),
      '    return program;',
      '  };',
      '});'
    ].join('\n');
  }
}

module.exports = Transpiler;
