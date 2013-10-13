var PYRET = (function () {

  function makeRuntime() {
    /*
    p-num
    p-bool
    p-str
    p-fun
    p-method
    p-nothing
    p-object
    p-base

    ---------------------

    p-mutable
    p-placeholder
    */

    //p-base
    function PBase(){}
    function isBase(v){ return v instanceof PBase }

    //p-method
    function PMethod(f) {
      this.method = f;
    }
    function makeMethod(f) { return new PMethod(f); } 
    function isMethod(v) { return v instanceof PMethod; }
    PMethod.prototype = {
      app: function() { throw "Cannot apply method directly."; },
      dict: {}
    };

    //p-fun
    function PFunction(f) {
      this.app = f;
    }
    function makeFunction(f) { return new PFunction(f); }
    function isFunction(v) { return v instanceof PFunction; }
    PFunction.prototype = {
      dict: {} 
    };

    //p-num
    var numberDict = {
      _plus: makeMethod(function(left, right) {
        if (isNumber(left) && isNumber(right))
        { return makeNumber(left.n + right.n); }
        else
        { throw "Type error"; };
      }),
      _minus: makeMethod(function(left, right) {
        return makeNumber(left.n - right.n);
      }),
      _times: makeMethod(function(left, right) {
        return makeNumber(left.n * right.n);
      }),
      _divide: makeMethod(function(left, right) {
        if (right.n !== 0) {
          return makeNumber(left.n / right.n);
        }
        else
          { throw "Cannot divide by 0"; };
      }),
      _equals: makeMethod(function(left, right) {
        return makeBool(left.n === right.n);
      }),
      floor: makeMethod(function(val) {
        return makeNumber(Math.floor(val.n));
      }),
      exp: makeMethod(function(val) {
        return makeNumber(Math.exp(val.n));
      }),
      _lessthan: makeMethod(function(left, right) {
        return makeBool(left.n < right.n);
      }),
      _greaterthan: makeMethod(function(left, right) {
        return makeBool(left.n > right.n);
      }),
      _lessequal: makeMethod(function(left, right) {
        return makeBool(left.n <= right.n);
      }),
      _greaterequal: makeMethod(function(left, right) {
        return makeBool(left.n >= right.n);
      }),
      max: makeMethod(function(left, right) {
        return makeNumber(Math.max(left.n, right.n));
      }),
      min: makeMethod(function(left, right) {
        return makeNumber(Math.min(left.n, right.n));
      }),
      tostring: makeMethod(function(val) {
        return makeString(val.n.toString());
      })

    };

    function PNumber(n) {
      this.n = n;
    }
    function makeNumber(n) { return new PNumber(n); }
    function isNumber(v) { return v instanceof PNumber; }
    PNumber.prototype = Object.create(PBase.prototype);
    PNumber.prototype.app = function() { throw "check-fun: expected function, got number"; };
    PNumber.prototype.dict = numberDict;

    //p-str
    var stringDict = {
      _plus: makeMethod(function(left, right) {
        return makeString(left.s + right.s);
      }),
      contains: makeMethod(function(str, substr) {
        return makeBool(str.s.indexOf(substr.s) != -1);
      }),
      replace: makeMethod(function(str, oldvalue, newvalue) {
        return makeString(str.s.replace(new RegExp(oldvalue.s, 'g'), newvalue.s));
      }),
      substring: makeMethod(function(str, from, to) {
        return makeString(str.s.substring(from.n, to.n));
      }),
      tostring: makeMethod(function(str) {
        return makeString(str.s);
      }),
      tonumber: makeMethod(function(str) {
        return makeNumber(parseInt(str.s));
      })
    };

    function PString(s) {
      this.s = s;
    }
    function makeString(s) { return new PString(s); }
    function isString(v) { return v instanceof PString; }
    PString.prototype = Object.create(PBase.prototype);
    PString.prototype.app = function() { throw "Cannot apply strings."; };
    PString.prototype.dict = stringDict;

    //p-bool
    var boolDict = {
      _and: makeMethod(function(left, right) {
        return makeBool(left.b && right.b);
      }),
      _or: makeMethod(function(left, right) {
        return makeBool(left.b || right.b);
      }),
      _equals: makeMethod(function(left, right) {
        return makeBool(left.b === right.b);
      }),
      _not: makeMethod(function(val) {
        return makeBool(!val.b);
      })
    };

    function PBool(b){
      this.b = b;
    }
    function makeBool(b) { return new PBool(b); }
    function isBool(v) { return v instanceof PBool; }
    PBool.prototype = Object.create(PBase.prototype);
    PBool.prototype.app = function() { throw "Cannot apply bools."; };
    PBool.prototype.dict = boolDict;

    //p-obj
    var objDict = {

    }
    function PObject(o){
      this.o = o;
    }
    function makeObject(o) { return new PObject(o); }
    function isObject(v) { return v instanceof PObject; }
    PObject.prototype = Object.create(PBase.prototype);
    PObject.prototype.app = function() { throw "Cannot apply numbers."; };
    PObject.prototype.dict = objDict;


    function equal(val1, val2) {
      if(isNumber(val1) && isNumber(val2)) {
        return val1.n === val2.n;
      }
      else if (isString(val1) && isString(val2)) {
        return val1.s === val2.s;
      }
      else if (isBool(val1) && isBool(val2)){
        return val1.b === val2.b;
      }
      return false;
    }

    function toRepr(val) {
      if(isNumber(val)) {
        return makeString(String(val.n));
      }
      else if (isString(val)) {
        return makeString('"' + val.s + '"');
      }
      else if (isBool(val)) {
        return makeString(String(val.b));
      }
      else if (isFunction(val)) {
        return makeString("fun: end");
      }
      else if (isMethod(val)) {
        return makeString("method: end");
      }
      throw ("toStringJS on an unknown type: " + val);
    }

    function getField(val, str) {
      var fieldVal = val.dict[str];
      if (isMethod(fieldVal)) {
        return makeFunction(function() {
          var argList = Array.prototype.slice.call(arguments);
          return fieldVal.method.apply(null, [val].concat(argList));
        });
      } else {
        return fieldVal;
      }
    }

    var testPrintOutput = "";
    function testPrint(val) {
      var str = toRepr(val).s;
      console.log("testPrint: ", val, str);
      testPrintOutput += str + "\n";
      return val;
    }

    function NormalResult(val) {
      this.val = val;
    }
    function makeNormalResult(val) { return new NormalResult(val); }

    function FailResult(exn) {
      this.exn = exn;
    }
    function makeFailResult(exn) { return new FailResult(exn); }

    function errToJSON(exn) {
      return JSON.stringify({exn: String(exn)})
    }

    return {
      nothing: {},
      makeNumber: makeNumber,
      isNumber: isNumber,
      makeString: makeString,
      isString: isString,
      makeBool: makeBool,
      isBool: isBool,
      equal: equal,
      getField: getField,
      getTestPrintOutput: function(val) {
        return testPrintOutput + toRepr(val).s;
      },
      NormalResult: NormalResult,
      FailResult: FailResult,
      makeNormalResult: makeNormalResult,
      makeFailResult: makeFailResult,
      toReprJS: toRepr,
      errToJSON: errToJSON,

      "test-print": makeFunction(testPrint),
    }
  }

  return {
    makeRuntime: makeRuntime
  };
})();

