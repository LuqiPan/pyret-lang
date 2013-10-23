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

    //brander
    function generateUUID() {
      var d = new Date().getTime();
      var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = (d + Math.random()*16)%16 | 0;
          d = Math.floor(d/16);
          return (c=='x' ? r : (r&0x7|0x8)).toString(16);
      });
      return uuid;
    };

    function PBrander() {
      var thisBrand = generateUUID();

      this.dict = {};

      this.dict.brand = makeMethod(function(dummy, val) {
        if(isNumber(val)) {
          var newVal = makeNumber(val.n);
          newVal.brands = val.brands.concat([thisBrand]);
          return newVal;
        }
        else if (isString(val)) {
          var newVal = makeString(val.s);
          newVal.brands = val.brands.concat([thisBrand]);
          return newVal;
        }
        else if (isBool(val)) {
          var newVal = makeBool(val.b);
          newVal.brands = val.brands.concat([thisBrand]);
          return newVal;
        }
        else if (isFunction(val)) {
          var newVal = makeFunction(val.app);
          newVal.brands = val.brands.concat([thisBrand]);
          return newVal;
        }
        else if (isMethod(val)) {
          var newVal = makeMethod(val.method);
          newVal.brands = val.brands.concat([thisBrand]);
          return newVal;
        }
        else if (isObject(val)) {
          var newVal = makeObject(val.dict);
          newVal.brands = val.brands.concat([thisBrand]);
          return newVal;
        }
        throw ("Not yet implemented" + val);
      });

      this.dict.test = makeMethod(function(dummy, val) {
        return makeBool(val.brands.indexOf(thisBrand) !== -1);
      });
    }
    var brander = {
      app: function(dummy) {
        return new PBrander();
      }
    };


    //raise function generator
    var appGenerator = function(type) {
      return function() {
        throw makeString("check-fun: expected function, got " + type);
      };
    }

    var mtdGenerator = function(type) {
      return function() {
        throw makeString("check-method: expected method, got " + type);
      };
    }

    //p-base
    function PBase() {}
    function isBase(v){ return v instanceof PBase }
    PBase.prototype = {
      brands: [],
      dict: {},
      app: appGenerator("base"),
      method: mtdGenerator("base")
    };



    //p-method
    function PMethod(f) {
      this.method = f;
    }
    function makeMethod(f) { return new PMethod(f); } 
    function isMethod(v) { return v instanceof PMethod; }
    PMethod.prototype = Object.create(PBase.prototype);
    PMethod.prototype.app = appGenerator("method");



    //p-fun
    function PFunction(f) {
      this.app = f;
    }
    function makeFunction(f) { return new PFunction(f); }
    function isFunction(v) { return v instanceof PFunction; }
    PFunction.prototype = Object.create(PBase.prototype);

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
        return makeNumber(Math.floor(val.n).toFixed(1));
      }),
      ceiling: makeMethod(function(val) {
        return makeNumber(Math.ceil(val.n).toFixed(1));
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
    PNumber.prototype.app = appGenerator("number");
    PNumber.prototype.dict = numberDict;
    //end p-num


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
      }),
      "char-at": makeMethod(function(str, n) {
        return makeString(str.s.charAt(n));
      })
    };

    function PString(s) {
      this.s = s;
    }
    function makeString(s) { return new PString(s); }
    function isString(v) { return v instanceof PString; }
    PString.prototype = Object.create(PBase.prototype);
    PString.prototype.app = appGenerator("string");
    PString.prototype.method = mtdGenerator("string");
    PString.prototype.dict = stringDict;
    //end p-str


    //p-bool
    var boolDict = {
      _and: makeMethod(function(left, right) {
        if (!left.b) {
          return makeBool(false);
        }
        else{
          return makeBool(right.app().b);
        }
      }),
      _or: makeMethod(function(left, right) {
        if (left.b) {
          return makeBool(true);
        }
        else{
          return makeBool(right.app().b);
        }
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
      this.app = appGenerator(b);
      this.method = mtdGenerator(b);
    }
    function makeBool(b) { return new PBool(b); }
    function isBool(v) { return v instanceof PBool; }
    PBool.prototype = Object.create(PBase.prototype);
    PBool.prototype.dict = boolDict;
    //end p-bool

    //p-mutable
    function PMutable(val, reads, writes) {
      this.val = val;
      this.reads = reads;
      this.writes = writes;
    }
    function isMutable(v) { return v instanceof PMutable; }
    PMutable.prototype = Object.create(PBase.prototype);
    PMutable.prototype.dict = {
      get: makeMethod(function(self) {
        return self.val;
      }),
      _equals: makeMethod(function(self, other) {
        return makeBool(self === other);
      })
    };
    PMutable.prototype.set = function(val) {
      //need to do some verification
      this.val = val;
    }

    //p-obj
    function PObject(objDict){
      this.dict = objDict;
      this.dict["_extend"] = makeMethod(function(obj, extendDict) {
        var mergeDict = {};
        for (var key in obj.dict) { mergeDict[key] = obj.dict[key]; }
        for (var key in extendDict) { mergeDict[key] = extendDict[key]; }
        return makeObject(mergeDict);
      });
    }
    function makeObject(objDict) { return new PObject(objDict); }
    function isObject(v) { return v instanceof PObject; }
    PObject.prototype = Object.create(PBase.prototype);
    PObject.prototype.app = function() { throw "Cannot apply objects."; };

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
      else if (isObject(val1) && isObject(val2)){
        return val1.dict === val2.dict;
      }
      else if (isMethod(val1) && isMethod(val2)){
        return val1.method === val2.method;
      }
      else if (isFunction(val1) && isFunction(val2)){
        return val1.app === val2.app;
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
      else if (isObject(val)) {
        return makeString("object");
      }
      throw ("toStringJS on an unknown type: " + val);
    }

    function getField(val, str) {
      var fieldVal = val.dict[str];
      if (typeof fieldVal === 'undefined')
      {
        throw new ("value not found");
      }
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
      if (isObject(exn)) exn = getField(exn, "message");
      return String(exn.s);
    }

    return {
      nothing: {},
      isBase: isBase,
      makeNumber: makeNumber,
      isNumber: isNumber,
      makeString: makeString,
      isString: isString,
      makeBool: makeBool,
      isBool: isBool,
      makeFunction: makeFunction,
      isFunction: isFunction,
      makeObject: makeObject,
      isObject: isObject,
      makeMutable: makeMutable,
      isMutable: isMutable,
      brander: brander,
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
      "is-number": makeFunction(function(v){return makeBool(isNumber(v))}),
    }
  }

  return {
    makeRuntime: makeRuntime
  };
})();

