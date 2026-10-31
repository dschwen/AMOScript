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
const createSpriteBuffer = require('./amos/spriteBuffer');
const createAmal = require('./amos/amal');
const createBoom = require('./amos/boom');
const createThreeD = require('./amos/threeD');
const readMod = require('./amos/mod');
const createTracker = require('./amos/tracker');
const readMusicBank = require('./amos/musicBank');
const createMusic = require('./amos/music');
const createBankMemory = require('./amos/bankMemory');
const { createIlbmReader } = require('./display/model/ilbm');
const writeIlbm = require('./display/model/ilbmWriter');
const { createAnimReader } = require('./amos/anim');
const readPackedPicture = require('./amos/packedPicture');
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
    this._stringLabels = lowered.stringLabels;
    this._variables = lowered.variables;
    this._procedures = lowered.procedures;
    this._dataScopes = lowered.dataScopes;
    this._variableBufferBytes = lowered.variableBufferBytes;
    this._stackEntries = lowered.stackEntries;
  }

  toModule({ optimize = false } = {}) {
    if (typeof optimize !== 'boolean') throw new Error('optimize must be a boolean');
    const blocks = [];
    const boundaries = new Set(Object.values(this._labels));
    if (optimize) {
      for (let start = 0; start < this._ops.length;) {
        let end = start;
        while (end < this._ops.length && end - start < 32 &&
          (end === start || !boundaries.has(end)) &&
          this._ops[end].kind === 'assign' && this._ops[end].pure) end++;
        if (end - start > 1) blocks.push({ start, length: end - start });
        start = Math.max(end, start + 1);
      }
    }
    const optimization = { mode: 'scalar-blocks', instructions: this._ops.length, blocks: blocks.length,
      batchedInstructions: blocks.reduce((sum, block) => sum + block.length, 0), maxBlockSize: 32 };
    const cases = this._ops.map((op, i) => {
      let body;
      switch (op.kind) {
        case 'display': body = `program.${op.target === 'program' ? '' : 'display.'}${op.method}(${op.args.join(', ')}); return {};`; break;
        case 'print': body = op.channel == null ? `program.print([${op.expr}], ${JSON.stringify(op.separators)}); return {};` : `program.filePrint(${op.channel}, [${op.expr}], ${JSON.stringify(op.separators)}); return {};`; break;
        case 'file_open': body = `program.fileOpen(${op.channel}, ${op.filename}, ${JSON.stringify(op.mode)}); return {};`; break;
        case 'file_close': body = `program.fileClose(${op.channel == null ? 'null' : op.channel}); return {};`; break;
        case 'assign': body = op.indices ? `const array = ${op.target}; const indices = [${op.indices.join(', ')}]; program.arrayIndex(array, indices); program.arraySet(array, indices, ${op.expr}); return {};` : `${op.target} = (${op.expr}); return {};`; break;
        case 'swap': {
          // Resolve both addresses before reading either value. Array offsets
          // and local owners stay captured while the second target evaluates.
          const reference = (operand, prefix) => {
            if (operand.indices) {
              const setup = `const ${prefix}Array = ${operand.target}; const ${prefix}Index = program.arrayTargetIndex(${prefix}Array, [${operand.indices.map(index => `() => (${index})`).join(', ')}]); `;
              const read = `${prefix}Array.values.has(${prefix}Index) ? ${prefix}Array.values.get(${prefix}Index) : ${prefix}Array.defaultValue`;
              return { setup, read, store: value => `${prefix}Array.values.set(${prefix}Index, ${value}); ` };
            }
            const setup = operand.local ? `const ${prefix}Owner = state.locals; ` : '';
            const target = operand.local ? `${prefix}Owner.${operand.target.slice('state.locals.'.length)}` : operand.target;
            return { setup, read: target, store: value => `${target} = ${value}; ` };
          };
          const left = reference(op.left, 'left'), right = reference(op.right, 'right');
          body = `${left.setup}${right.setup}const rightValue = ${right.read}; const leftValue = ${left.read}; ${right.store('leftValue')}${left.store('rightValue')}return {};`;
          break;
        }
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
        case 'add_integer': {
          const capture = op.indices ? `const array = ${op.target}; const indices = [${op.indices.join(', ')}]; program.arrayIndex(array, indices); ` : '';
          const current = op.indices ? 'program.arrayGet(array, indices)' : op.target;
          const result = `program.addInteger(${current}, delta, low, high)`;
          body = `${capture}const delta = ${op.delta}; const low = ${op.low || 'null'}; const high = ${op.high || 'null'}; ${op.indices ? `program.arraySet(array, indices, ${result})` : `${op.target} = ${result}`}; return {};`;
          break;
        }
        case 'on_error': {
          const info = op.procedure && this._procedures.get(op.procedure);
          const defaults = info ? Object.fromEntries(Array.from(info.locals, ([name, value]) => [name, JSON.parse(value)])) : null;
          body = `return { onError: ${op.branch === 'Off' ? 'null' : `{ target: ${this._labels[op.label]}, procedure: ${JSON.stringify(op.procedure)}, defaults: ${JSON.stringify(defaults)}, data: dataTables[${JSON.stringify(op.procedure || '@main')}] }`} };`; break;
        }
        case 'resume_label': body = `return { resumeLabel: ${op.label == null ? 'null' : this._labels[op.label]} };`; break;
        case 'input': {
          const setup = 'const inputOwner = state.locals;' + op.targets.map((target, index) => target.indices ? `const array${index} = ${target.storage}; const indices${index} = [${target.indices.join(',')}]; program.arrayIndex(array${index}, indices${index});` : '').join('');
          const stores = op.targets.map((target, index) => target.indices ? `program.arraySet(array${index}, indices${index}, values[${index}]);` : `${target.storage.replace('state.locals.', 'inputOwner.')} = values[${index}];`).join('');
          body = `${setup}const prompt = ${op.prompt}; return { input: { prompt, types: ${JSON.stringify(op.targets.map(t => t.type))}, commit: values => { ${op.targets.map((target, index) => target.indices ? `program.arrayIndex(array${index}, indices${index});` : '').join('')} ${stores} } } };`; break;
        }
        case 'restore': body = `state.data.index = ${op.index}; return {};`; break;
        case 'branch_false': body = `return (${op.cond}) ? {} : { goto: ${this._labels[op.label]} };`; break;
        case 'goto': body = `return { goto: ${this._labels[op.label]} };`; break;
        case 'gosub': body = `return { call: ${this._labels[op.label]} };`; break;
        case 'string_branch': body = `return { ${op.branch === 'Gosub' ? 'call' : 'goto'}: program.stringBranchTarget(${op.expr}, stringLabels) };`; break;
        case 'on_branch':
          body = `const selector = ${op.expr}; const targets = ${JSON.stringify(op.labels.map(label => this._labels[label]))}; return selector >= 1 && selector <= targets.length ? { ${op.branch === 'Gosub' ? 'call' : 'goto'}: targets[selector - 1] } : {};`;
          break;
        case 'return': body = 'return { ret: true };'; break;
        case 'pop': body = 'return { pop: true };'; break;
        case 'end': body = 'return { halt: true };'; break;
        case 'edit': body = 'return { edit: true };'; break;
        case 'run': body = `return { run: program.runRequest(${op.filename==null?'null':op.filename}) };`; break;
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
        case 'proc_return': body = `return { procReturn: true${op.discard ? ', discardGosubs: true' : ''}${op.expr != null ? `, result: ${op.expr}, resultType: ${JSON.stringify(op.type)}` : ''} };`; break;
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
      `  const ilbmWriterFactory = ${writeIlbm.toString()};`,
      `  const packedPictureReader = ${readPackedPicture.toString()};`,
      `  const animReaderFactory = (${createAnimReader.toString()})(ilbmReaderFactory);`,
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
      `  const boomFactory = ${createBoom.toString()};`,
      `  const threeDFactory = ${createThreeD.toString()};`,
      `  const spriteBufferFactory = ${createSpriteBuffer.toString()};`,
      `  const amalFactory = ${createAmal.toString()};`,
      `  const audioFactory = ${createAudio.toString()};`,
      `  const modReaderFactory = ${readMod.toString()};`,
      `  const trackerFactory = ${createTracker.toString()};`,
      `  const musicReaderFactory = ${readMusicBank.toString()};`,
      `  const musicFactory = ${createMusic.toString()};`,
      `  const bankMemoryFactory = ${createBankMemory.toString()};`,
      `  const createProgram = ${createProgram.toString()};`,
      '  return function create(opts = {}){',
      '    const cases = [];',
      `    const stringLabels = Object.freeze(Object.fromEntries(${JSON.stringify(Array.from(this._stringLabels))}));`,
      ...Array.from(this._variables, ([name, value]) => `    let ${name} = ${value};`),
      '    const dataTables = Object.create(null);',
      ...Array.from(this._dataScopes, ([name, table]) => `    dataTables[${JSON.stringify(name)}] = [${table.entries.map(entry => `{ type: ${JSON.stringify(entry.type)}, read: state => (${entry.expr == null ? 'null' : entry.expr}), location: ${JSON.stringify(entry.location)} }`).join(', ')}];`),
      ...cases,
      ...(optimize ? ['    const blocks = [];', ...blocks.map(block =>
        `    blocks[${block.start}] = { length: ${block.length}, run: function(state) { ${this._ops.slice(block.start, block.start + block.length).map(op =>
          `state.location = ${JSON.stringify(op.location)}; ${op.target} = (${op.expr}); state.ticks++; state.ip++;`).join(' ')} } };`)] : []),
      `    const program = createProgram(cases, Object.assign({}, opts, { banks: ${JSON.stringify(this.banks)} })${optimize ? ', blocks' : ''});`,
      `    program.compilation = Object.freeze({ variableBufferBytes: ${JSON.stringify(this._variableBufferBytes)}, stackEntries: ${JSON.stringify(this._stackEntries)}${optimize ? `, optimization: Object.freeze(${JSON.stringify(optimization)})` : ''} });`,
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
