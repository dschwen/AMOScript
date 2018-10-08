/* jshint esversion: 6 */

class RuleFunctions
{
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
    return (...args) => `${func}(${args.join(',')})`;
  }

  generateString(text)
  {
    return () => text;
  }

  generateAmosTrig(func)
  {
    return first => func + `(AMOState.trigFactor*(${first}))`;
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
  }

  amosProcedure(end_offset, proc_name)
  {}

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
}

module.exports = RuleFunctions;
