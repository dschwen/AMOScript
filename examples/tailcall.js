/* jshint esversion: 6 */
/*

1 Procedure TEST
2   Print "Hello"
3 End Proc

4 Print "Begin"
5 TEST()
6 Wait 50
7 Print "End"

*/

// start code at line4
line4([], {});

// line 1 registers the procedure
function line2(s,v)
{
  console.log('Hello');
  endproc(s,v)
}

// this call is generic
function endproc(s,v)
{
  var ret = s.pop();
  ret(s,v);
}

function line4(s,v)
{
  console.log('Begin');
  line5(s,v);
}

function line5(s,v)
{
  // return to the next line
  s.push(() => { line6(s,v)})
  // call procedure
  line2(s,{}); // here we pass in the parameters, not the scope local variables v
  // need a stack for locals for nested procedure calls!
}

function line6(s,v)
{
  // Wait
  setTimeout(() => { line7(s,v)}, 5000);
  // at this point we unwind the stack and no further operations happen
}

function line7(s,v)
{
  console.log('End');
  // end of code
}
