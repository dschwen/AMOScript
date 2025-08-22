/* jshint esversion: 6 */

class RuleFunctions
{
  constructor()
  {
    // loop lowering helpers
    this._forStack = [];
    this._gensymCounter = 0;
  }
  pass(ret) { return ret; }

  returnNull()
  {
    return null;
  }

  generateUnary(operator)
  {
    return first => operator + first;
  }

  generateBinary(operator)
  {
    return (first, second) => first + operator + second;
  }

  generateFunction(func)
  {
    return (...args) => {
      const expr = args.join(',');
      if (func === 'print') {
        // console.log('emit print at line', this._buffer.lineNumber(), expr);
        this.emit({ kind: 'print', expr });
      }
      return `${func}(${expr})`;
    };
  }

  dropFirst(n, fn)
  {
    return (...args) => fn.apply(this, args.slice(n));
  }

  generateString(text)
  {
    return () => text;
  }

  generateAmosTrig(func)
  {
    return first => func + `(AMOState.trigFactor*(${first}))`;
  }

  join(...args)
  {
    return args.join('');
  }

  joinComma(first, second)
  {
    if (second !== null)
      return `${first}, ${second}`;
    return first;
  }

  joinNewLine(first, second)
  {
    if (second !== null)
      return `${first}\n${second}`;
    return first;
  }

  alignToLineEnd()
  {
    const b = this._buffer;
    // Prefer the line index captured at header match
    const idx = (this._currentLineIndex != null) ? this._currentLineIndex : b.lineNumber();
    const start = b.lines[idx];
    const lenWords = b.getByte(start);
    b.ip = start + lenWords * 2;
    this._currentLineIndex = null;
  }

  expectEOL()
  {
    // Only match if next word marks end-of-line (0x0000)
    const w = this._buffer.getWord(this._buffer.ip);
    return (w === 0x0000) ? '' : null;
  }

  amosParens(value)
  {
    return `(${value})`;
  }

  amosPow(left, right)
  {
    return `Math.pow(${left}, ${right})`;
  }

  amosXor(left, right)
  {
    return `((${left}) | (${right})) & ~((${left}) & (${right}))`;
  }

  amosRem(len, comment)
  {
    return `/* ${comment} */`;
  }

  amosIdentifier(len, flags, name)
  {
    if (flags & 1)
      name = 'float_' + name;
    else if (flags & 2)
      name = 'string_' + name;
    else
      name = 'int_' + name;

    return name;
  }

  amosVariableAssignment(variable, expression)
  {
    this.emit({ kind: 'assign', target: variable, expr: expression });
    return `${variable} = ${expression}`;
  }

  amosFloat(bits)
  {
    let exponent = bits & 0b1111111;
    let sign = (bits & 0b10000000) ? '-' : '';
    let mantissa = (bits >>> 8);
    return sign + (mantissa * Math.pow(2, exponent - 88)).toString(10);
  }

  amosInteger(val)
  {
    return val.toString(10);
  }

  amosDQString(len, text)
  {
    return `"${text}"`;
  }

  amosSQString(len, text)
  {
    return `'${text}'`;
  }

  amosForTo(var_name, start, end, step = 1)
  {
    // console.log('FOR at line', this._buffer.lineNumber(), var_name, start, end, step);
    // Initialize loop variable
    this.emit({ kind: 'assign', target: var_name, expr: start });

    // Create labels for check and end
    const idx = this._gensymCounter++;
    const checkLabel = `__for_check_${idx}`;
    const endLabel = `__for_end_${idx}`;

    // Define the check label at this point
    this.defineLabel(checkLabel);

    // Compute condition based on step sign (runtime-safe)
    const stepExpr = step;
    const cond = `(((${stepExpr}) >= 0) ? ((${var_name}) <= (${end})) : ((${var_name}) >= (${end})))`;
    this.emit({ kind: 'branch_false', cond, label: endLabel });

    // Push frame for matching Next
    this._forStack.push({ var_name, end, step: stepExpr, checkLabel, endLabel });

    // Return a descriptive string (not used by codegen directly)
    return `for ${var_name}=${start} to ${end} step ${stepExpr}`;
  }

  amosNext(var_name = null)
  {
    if (!this._forStack.length) return 'next';
    const frame = this._forStack[this._forStack.length - 1];
    // If a variable is provided, ensure it matches; otherwise close the most recent
    if (var_name && var_name !== frame.var_name) {
      // naive handling: allow mismatched NEXT by ignoring (AMOS allows grouping),
      // but we will still use the most recent frame
    }

    // increment and jump back to check
    const incExpr = `(${frame.var_name}) + (${frame.step})`;
    this.emit({ kind: 'assign', target: frame.var_name, expr: incExpr });
    this.emit({ kind: 'goto', label: frame.checkLabel });

    // place the end label here and pop frame
    this.defineLabel(frame.endLabel);
    // ensure a concrete target exists for gotos to end label
    this.emit({ kind: 'nop' });
    this._forStack.pop();

    return 'next';
  }

  amosProcedure(end_offset, proc_name)
  { /* TODO */ }

  amosProcedureCall(proc_name)
  {
    // if getWord = 0x0084 ([)  ... 0x008C (]) parameters separated by 0x005C (,)
  }

  amosInc(var_name)
  {
    // var_name++
  }

  amosDec(var_name)
  {
    // var_name--
  }

  // Control flow lowers
  amosGosub(identifier)
  {
    this.emit({ kind: 'gosub', label: identifier });
    return `gosub ${identifier}`;
  }

  amosGoto(identifier)
  {
    this.emit({ kind: 'goto', label: identifier });
    return `goto ${identifier}`;
  }

  amosReturn()
  {
    this.emit({ kind: 'return' });
    return 'return';
  }

  amosEnd()
  {
    this.emit({ kind: 'end' });
    return 'end';
  }

  amosSetLabel(label, body)
  {
    this.defineLabel(label);
    return body;
  }

  //

  // Hooks for transpiler to attach
  emit(op)
  {
    if (typeof this._emit === 'function') this._emit(op);
  }

  defineLabel(name)
  {
    if (typeof this._defineLabel === 'function') this._defineLabel(name);
  }
}

module.exports = RuleFunctions;
