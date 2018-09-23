# Transpiler

Transpiling AMOS basic into JavaScript comes with two challenges

1. `Goto` and `Gosub` allow for arbitrarily convoluted code paths. JavaScript does
   not natively support this
2. Synchronous AMOS vs. asynchronous JavaScript. AMOS follows a synchronous model,
   with busy waiting for keypresses etc. This would freeze the browser and input
   state cannot be checked synchronously

The transpiler converts each instruction into a JS function that returns the next
function (i.e. instruction) to be executed. Normally that is just the next line's
function. However asynchronous functions can return true, which will stop the main
loop and rely on the async instruction to set up an event handler that jumps back
into the main loop.

## Examples

### Simple synchronous instruction

Executes the `Print` command and returns the next line to be executed

```
function op_0() { token_476("Hello World"); return op_1; }
```

### Asynchronous instruction

Executes the `Wait` command to asynchronously wait for one second

```
function i_1_0() { AMOS.call_stack.push(i_2_0); async_129e(50); return true; }
```
