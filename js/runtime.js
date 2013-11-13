var PYRET = (function () {

  function makeRuntime() {

    //brander
    function generateUUID() {
      //http://jsfiddle.net/briguy37/2MVFd/
      var d = new Date().getTime();
      var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = (d + Math.random()*16)%16 | 0;
          d = Math.floor(d/16);
          return (c=='x' ? r : (r&0x7|0x8)).toString(16);
      });
      return uuid;
    };

    function PBrander() {
      /*a lot of duplicate code here,
      these can be reduced*/
      var thisBrand = generateUUID();

      return makeObject({
        brand: makeMethod(function(dummy, val) {
          var newVal;
          if (isObject(val)) {
            newVal = makeObject(val.dict);
          }
          else if(isNumber(val)) {
            newVal = makeNumber(val.n);
          }
          else if (isString(val)) {
            newVal = makeString(val.s);
          }
          else if (isBool(val)) {
            newVal = makeBool(val.b);
          }
          else if (isFunction(val)) {
            newVal = makeFunction(val.app, val.dict._doc);
          }
          else if (isMethod(val)) {
            newVal = makeMethod(val.method, val.dict._doc);
          }
          else if (isMutable(val)) {
            newVal = makeMutable(val.val, val.reads.slice(0), val.writes.slice(0));
          }
          else if (isPlaceholder(val)) {
            newVal = new PPlaceholder();

            for (var i in val.guards) {
              applyFunc(getField(val, "guard"), [val.guards[i]]);
            }
            newVal.set(val.val);
          }
          newVal.brands = val.brands.concat([thisBrand]);
          return newVal;
      }),
      test: makeMethod(function(dummy, val) {
        return makeBool(val.brands.indexOf(thisBrand) !== -1);
      })
    });
    }
    var brander = makeFunction(function() {
      return new PBrander();
    });
    //end brander


    //raise function generator
    var appGenerator = function(type) {
      return function() {
        throw makePyretException(makeString("check-fun: expected function, got " + type));
      };
    }

    var mtdGenerator = function(type) {
      return function() {
        throw makePyretException(makeString("check-method: expected method, got " + type));
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

    //pnothing
    function PNothing() {}
    function isNothing(v) { return v instanceof PNothing; }
    PNothing.prototype = Object.create(PBase.prototype);
    PNothing.prototype.dict = {
      _torepr: makeMethod(function(s) {
        return makeString("nothing");
      })
    };
    var nothing = new PNothing();
    //nothing

    //p-method
    function PMethod(m, doc) {
      if (doc === undefined) { doc = makeString(""); };
      this.dict = {
        _doc: doc
      };
      this.method = m;
      this.arity = m.length;
    }
    function makeMethod(m, doc) {
      var mtd = new PMethod(m, doc);

      var _fun = new PMethod(function(self) {
        return makeFunction(m, doc);
      });
      _fun.dict = {};
      _fun.dict["_doc"] = doc;
      _fun.dict["_fun"] = _fun;

      mtd.dict._fun = _fun;

      return mtd;
    } 
    function isMethod(v) { return v instanceof PMethod; }
    PMethod.prototype = Object.create(PBase.prototype);
    PMethod.prototype.app = appGenerator("method");
    //end p-method


    //p-fun
    function PFunction(f, doc) {
      if (doc === undefined) { doc = makeString(""); };
      this.dict = {
        _doc: doc
      };
      this.app = f;
      this.arity = f.length;
    }
    function makeFunction(f, doc) { 
      var fun = new PFunction(f, doc);

      fun.dict._method = makeMethod(function(self) {
        return makeMethod(f, doc);
      })

      return fun; 
    }
    function isFunction(v) { return v instanceof PFunction; }
    PFunction.prototype = Object.create(PBase.prototype);
    PFunction.prototype.method = mtdGenerator("function");
    function applyFunc(f, argList) {
      if (f.arity === undefined) f.arity = f.app.length;
      if (f.arity !== argList.length) {
        throw makePyretException(makeString("Wrong number of arguments given to function."));
      };

      return f.app.apply(null, argList);
    }
    //end p-fun

    //p-num
    var numberDict = {
      _plus: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "plus", [left, right]);
        return makeNumber(left.n + right.n);
      }),
      _add: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "add", [left, right]);
        return makeNumber(left.n + right.n);
      }),
      _minus: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "minus", [left, right]);
        return makeNumber(left.n - right.n);
      }),
      _divide: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "divide", [left, right]);
        if (right.n !== 0) {
          return makeNumber(left.n / right.n);
        }
        else
          { throw makePyretException(makeString("Division by zero")); };
      }),
      _times: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "times", [left, right]);
        return makeNumber(left.n * right.n);
      }),
      _torepr: makeMethod(function(self) {
        return makeString(self.n.toString());
      }),
      _equals: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "equals", [left, right]);
        return makeBool(left.n === right.n);
      }),
      _lessthan: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "lessthan", [left, right]);
        return makeBool(left.n < right.n);
      }),
      _greaterthan: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "greaterthan", [left, right]);
        return makeBool(left.n > right.n);
      }),
      _lessequal: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "lessequal", [left, right]);
        return makeBool(left.n <= right.n);
      }),
      _greaterequal: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "greaterequal", [left, right]);
        return makeBool(left.n >= right.n);
      }),
      tostring: makeMethod(function(val) {
        return makeString(val.n.toString());
      }),
      modulo: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "modulo", [left, right]);
        return makeNumber(left.n % right.n);
      }),
      truncate: makeMethod(function(val) {
        return makeNumber(Math.floor(val.n));
      }),
      abs: makeMethod(function(val) {
        return makeNumber(Math.abs(vals.n));
      }),
      max: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "max", [left, right])
        return makeNumber(Math.max(left.n, right.n));
      }),
      min: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "min", [left, right])
        return makeNumber(Math.min(left.n, right.n));
      }),
      sin: makeMethod(function(val) {
        return makeNumber(Math.sin(val.n));
      }),
      cos: makeMethod(function(val) {
        return makeNumber(Math.cos(val.n));
      }),
      tan: makeMethod(function(val) {
        return makeNumber(Math.tan(val.n));
      }),
      asin: makeMethod(function(val) {
        return makeNumber(Math.asin(val.n));
      }),
      acos: makeMethod(function(val) {
        return makeNumber(Math.acos(val.n));
      }),
      atan: makeMethod(function(val) {
        return makeNumber(Math.atan(val.n));
      }),
      sqr: makeMethod(function(val) {
        return makeNumber(val.n * val.n);
      }),
      sqrt: makeMethod(function(val) {
        return makeNumber(Math.sqrt(val.n));
      }),
      ceiling: makeMethod(function(val) {
        return makeNumber(Math.ceil(val.n).toFixed(1));
      }),
      floor: makeMethod(function(val) {
        return makeNumber(Math.floor(val.n).toFixed(1));
      }),
      log: makeMethod(function(val) {
        return makeNumber(Math.log(val.n));
      }),
      exp: makeMethod(function(val) {
        return makeNumber(Math.exp(val.n));
      }),
      exact: makeMethod(function(val) {
        return val;
      }),
      expt: makeMethod(function(left, right) {
        checkPrimitive(isNumber, "expt", left, right);
        return makeNumber(Math.pow(left.n, right.n));
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
        checkPrimitive(isString, "plus", [left, right]);
        return makeString(left.s + right.s);
      }),
      _lessequal: makeMethod(function(left, right) {
        checkPrimitive(isString, "lessequal", [left, right]);
        return makeBool(left.s <= right.s);
      }),
      _lessthan: makeMethod(function(left, right) {
        checkPrimitive(isString, "lessthan", [left, right]);
        return makeBool(left.s < right.s);
      }),
      _greaterthan: makeMethod(function(left, right) {
        checkPrimitive(isString, "greaterthan", [left, right]);
        return makeBool(left.s > right.s);
      }),
      _greaterequal: makeMethod(function(left, right) {
        checkPrimitive(isString, "greaterequal", [left, right]);
        return makeBool(left.s >= right.s);
      }),
      _equals: makeMethod(function(left,right) {
        checkPrimitive(isString, "equals", [left, right]);
        return makeBool(left.s === right.s);
      }),
      append: makeMethod(function(left, right) {
        checkPrimitive(isString, "append", [left, right]);
        return makeString(left.s + right.s);
      }),
      contains: makeMethod(function(str, substr) {
        checkPrimitive(isString, "contains", [str, substr]);
        return makeBool(str.s.indexOf(substr.s) != -1);
      }),
      replace: makeMethod(function(str, oldvalue, newvalue) {
        checkPrimitive(isString, "replace", [oldvalue, newvalue]);
        return makeString(str.s.replace(new RegExp(oldvalue.s, 'g'), newvalue.s));
      }),
      substring: makeMethod(function(str, from, to) {
        checkPrimitive(isNumber, "substring", [from, to]);
        return makeString(str.s.substring(from.n, to.n));
      }),
      "char-at": makeMethod(function(str, n) {
        checkPrimitive(isNumber, "char-at", [n]);
        return makeString(str.s.charAt(n));
      }),
      repeat: makeMethod(function(self, n) {
        checkPrimitive(isNumber, "repeat", [n]);
        return makeString(self.s.repeat(n.n));
      }),
      length: makeMethod(function(self) {
        return makeNumber(self.s.length);
      }),
      tonumber: makeMethod(function(str) {
        var n = parseFloat(str.s);
        if (isNaN(n)) return nothing;
        return makeNumber(n);
      }),
      tostring: makeMethod(function(str) {
        return makeString(str.s);
      }),
      _torepr: makeMethod(function(str) {
        return makeString("\"" + l.s + "\"");
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
      tostring: makeMethod(function(self) {
        return makeString(self.b.toString());
      }),
      _torepr: makeMethod(function(self) {
        return makeString(self.b.toString());
      }),
      _equals: makeMethod(function(left, right) {
        checkPrimitive(isBool, "equals", [left, right]);
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
    function isTrue(b) { return isBool(b) && b.b; }
    PBool.prototype = Object.create(PBase.prototype);
    PBool.prototype.dict = boolDict;
    //end p-bool

    //p-mutable
    function PMutable(val, reads, writes) {
      this.val = val;
      this.reads = reads;
      this.writes = writes;
    }
    function makeMutable(val, reads, writes) {
      if (reads === undefined) reads = [];
      if (writes === undefined) writes = [];
      return new PMutable(val, reads, writes);
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
    var mkSimpleMutable = function(val) {
      return new PMutable(val, [], []);
    };
    //end p-mutable

    //p-placeholder
    function getPlaceholderValue(p){
      if (!isPlaceholder(p)){
        throwTypeError("Placeholder", p);
      }
      if (p.v !== undefined) {
        return p.v;
      }
      else {
        throw makePyretException(makeString("Tried to get value from uninitialized placeholder"));
      }
    }
    function PPlaceholder() { this.guards = []; }
    function isPlaceholder(v) { return v instanceof PPlaceholder; }
    PPlaceholder.prototype = Object.create(PBase.prototype);
    PPlaceholder.prototype.app = appGenerator("placeholder");
    PPlaceholder.prototype.method = mtdGenerator("placeholder");
    PPlaceholder.prototype.dict = {
      _equals: makeMethod(function(self, other) {
        checkPrimitive(isPlaceholder, "equals", [self, other]);
        return makeBool(self === other)
      }),
      _torepr: makeMethod(function(self) {
        return makeString("cyclic-field");
      }),
      tostring: makeMethod(function(self) {
        return makeString("cyclic-field");
      }),
      get: makeMethod(function(self) {
        getPlaceholderValue(self);
      }),
      guard: makeMethod(function(self, g) {
        if (!isPlaceholder(self)) {
          throwTypeError("Placeholder", self);
        }
        else{
          if (self.v !== undefined) { throw makePyretException(makeString("Tried to set value in already-initialized placeholder")); }
          checkBrand.app(makePredicate(isFunction), g, makeString("Function"));

          self.guards.push(g);
        }
      }),
      set: makeMethod(function(self, val) {
        if (!isPlaceholder(self)) {
          throwTypeError("Placeholder", self);
        }
        else if (self.v !== undefined){
          throw makePyretException(makeString("Tried to set value in already-initialized placeholder"));
        }
        else {
          for (var i in self.guards){
            try{
              self.guards[i].app(v);
            }
            catch (e) {
              /*throw makePyretExceptionSys(makeObject({
                message: e,
                type: makeString("")
              }));*/
              throw makePyretException(e.exnVal);
            }
          }
        }
      })
    }
    //end p-placeholder

    //p-obj
    function PObject(objDict){
      this.dict = objDict;
    }
    function makeObject(objDict) { return new PObject(objDict); }
    function isObject(v) { return v instanceof PObject; }
    PObject.prototype = Object.create(PBase.prototype);
    PObject.prototype.app = function() { throw "Cannot apply objects."; };
    PObject.prototype.extend = function(extendDict) {
      var mergeDict = {};
      var updateFlag = false;
      for (var key in this.dict) { mergeDict[key] = this.dict[key]; }
      for (var key in extendDict) { 
        if (mergeDict[key] !== undefined) {
          updateFlag = true;
        }
        mergeDict[key] = extendDict[key]; 
      }
      var o = makeObject(mergeDict);

      if (!updateFlag) {
        o.brands = this.brands.slice(0);
      }

      return o;
    };
    PObject.prototype.mutate = function(mutateDict) {
      for (var key in mutateDict) { 
        if(this.dict[key] === undefined) { 
          throw makePyretException(makeString(key + "does not exist"))
        }
        if(isMutable(this.dict[key])){
          this.dict[key].set(mutateDict[key]);
        }
        else{ 
          throw makePyretException(makeString("Mutate on a non mutable field " + key)); 
        }
      }
      return this;
    };
    //end p-obj

    //Generic Helpers
    var checkBrand = makeFunction(function(ck, o, s) {
      if (isString(s)) {
        if (isFunction(ck)) {
          var check_v = ck.app(o);
          if (isTrue(check_v)){
            return o;
          }
          else {
            throw makePyretException(s);
          };
        }
        else {
          throw makePyretException(makeString("non-function"));
        }
      }
      else {
        throw makePyretException(makeString("check-brand failed"));
      };
    });

    function makePredicate(f) {
      return makeFunction(function(v) {
        return makeBool(f(v));
      });
    }

    function checkPrimitive(f, name, args) {
      for (var i = 0; i < args.length; i++) {
        if (!f(args[i])) throw makePyretException(makeString("Bad args to prim: " + name + " : " +
          Array.prototype.map.call(args, function (arg) {
            return String(toRepr(arg).s).replace(/\"+/g, ""); 
          }).join(", ")));
      }
    }

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
      else if (isMutable(val1) && isMutable(val2)) {

      }
      else if (isPlaceholder(val1) && isPlaceholder(val2)){

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
      else if (isPlaceholder(val)) {
        return makeString("cyclic-field");
      }
      else if (isMutable(val)) {
        return makeString("mutable-field");
      }
      else if (isNothing(val)) {
        return makeString("nothing");
      }
      throw ("toStringJS on an unknown type: " + val);
    }

    function getRawField(val, str) {
      if (str instanceof PString) str = str.s;
      var fieldVal = val.dict[str];
      if (fieldVal !== undefined) {
        return fieldVal;
      }
      else{
        throw makePyretException(makeString(str + " was not found on " + toRepr(val).s))
      }
    }

    function getField(val, str) {
      var fieldVal = getRawField(val, str);

      if (isMutable(fieldVal)) {
        throw makePyretException(makeString("Cannot look up mutable field \"" + str +"\" using dot or bracket"));
      }
      else if (isPlaceholder(fieldVal)) { return getPlaceholderValue(fieldVal); }
      else if (isMethod(fieldVal)) {
        var f = makeFunction(function() {
          var argList = Array.prototype.slice.call(arguments);
          return fieldVal.method.apply(null, [val].concat(argList));
        }, fieldVal.dict._doc);
        f.arity = fieldVal.method.length - 1;
        return f;
      } else {
        return fieldVal;
      }
    }

    function getMutableField(val, str) {
      var fieldVal = getRawField(val, str);
      if (isMutable(fieldVal)) {
        return fieldVal.val;
      }
      else {
        throw makePyretException(makeString("Cannot look up immutable field\"" + str + "\" with the ! operator"));
      }
    }

    var testPrintOutput = "";
    function testPrint(val) {
      var str = toRepr(val).s;
      console.log("testPrint: ", val, str);
      testPrintOutput += str + "\n";
      return val;
    }

    function NormalResult(val, namespace) {
      this.val = val;
      this.namespace = namespace;
    }
    function makeNormalResult(val, ns) { return new NormalResult(val, ns); }

    function FailResult(exn) {
      this.exn = exn;
    }
    function makeFailResult(exn) { return new FailResult(exn); }

    function PyretException(exnVal, exnSys) {
      this.exnVal = exnVal;
      this.exnSys = exnSys;
    }
    function makePyretException(exnVal) {
      return new PyretException(exnVal, false);
    }
    function makePyretExceptionSys(exnVal) {
      return new PyretException(exnVal, true);
    }

    function throwTypeError(typename, o) {
      throw makePyretException(makeString("typecheck failed; expected " + typename + " and got\n" + toRepr(o).s));
    }

    function unwrapException(exn) {
      if (!(exn instanceof PyretException)) throw exn;
      console.log(exn);
      return makeObject({
        path: makeString(""),
        line: makeString(""),
        column: makeString(""),
        value: exn.exnVal,
        system: makeBool(exn.exnSys),
      });
    }

    /*function errToJSON(exn) {
      if (isObject(exn)) exn = getField(exn, "message");
      return String(exn.s);
      return JSON.stringify({exn: String(exn)});
      return exn;
    }*/

    error = makeObject({
      'make-error' : makeFunction(function(e) {
        return e.exnVal;
      })
    })

    return {
      namespace: Namespace({
        nothing: nothing,

        "is-function": makePredicate(isFunction),
        "is-method": makePredicate(isMethod),
        "is-object": makePredicate(isObject),
        "is-number": makePredicate(isNumber),
        "is-bool": makePredicate(isBool),
        "is-string": makePredicate(isString),
        "is-mutable": makePredicate(isMutable),
        "is-placeholder": makePredicate(isPlaceholder),

        Any: makePredicate(isBase),
        Method: makePredicate(isMethod),
        Object: makePredicate(isObject),
        String: makePredicate(isString),
        Number: makePredicate(isNumber),
        Mutable: makePredicate(isMutable),
        Function: makePredicate(isFunction),

        "test-print": makeFunction(testPrint),
        tostring: makeFunction(function(val) {
          if (val.dict["tostring"] !== undefined) {
            return applyFunc(getField(val, "tostring"), []);
          }
          else {
            return applyFunc(getField(val, "_torepr"), []);
          }
        }),
        torepr: makeFunction(toRepr),
        brander: brander,
        raise: makeFunction(function(e) {
          throw makePyretException(e);
        }),
        "check-brand": checkBrand,
        "mk-placeholder": makeFunction(function() {
          return new PPlaceholder();
        }),
        "mk-simple-mutable": makeFunction(mkSimpleMutable),
        "mk-mutable": makeFunction(function(val, read, write) {
          checkBrand.app(makePredicate(isFunction), read, makeString("Function"));
          checkBrand.app(makePredicate(isFunction), write, makeString("Function"));
          return new PMutable(val, [read], [write]);
        }),
        "prim-has-field": makeFunction(function(prim, field) {
          return makeBool(prim.dict[field.s] !== undefined);
        }),
        "prim-num-keys": makeFunction(function(prim) {
          return makeNumber(Object.keys(prim.dict).length);
        }),
        "prim-keys": makeFunction(function(prim) {
          var keys = Object.keys(prim.dict);
          var obj = makeObject({ "is-empty": makeBool(true) });
          for (var i in keys) {
            obj = makeObject({
              "is-empty": makeBool(false),
              first: makeString(keys[i]),
              rest: obj
            });
          }

          return obj;
        }),
        "equiv": makeFunction(function(obj1, obj2) {
          function all_same(o1, o2) {
            if (isFunction(o1) || isMethod(o1)) {
              return false;
            }
            else {
              var left_val;
              var right_val;
              var same = true;

              for (var key in o1.dict) {
                if ((o2.dict === undefined) || (o2.dict[key] === undefined)) {
                  same = false;
                }
                else {
                  left_val = o1.dict[key];
                  right_val = o2.dict[key];
                  same = same && equiv(left_val, right_val);
                }

                if (!same) break;
              }

              return same;
            }
          }

          if (obj1.dict !== undefined && obj1.dict["_equals"] !== undefined) {
            console.log(obj1, obj2);
            return applyFunc(getField(obj1, "_equals"), [obj2]);
          }
          else if(Object.keys(obj1.dict).length == Object.keys(obj2.dict).length) {
            return makeBool(all_same(obj1, obj2));
          }
          else {
            return makeBool(false);
          }
        }),
        "data-to-repr": makeFunction(function(val, name, fields) {
          var out = [];
          var fieldList = [];
          var lst = fields;

          if(lst.dict["first"] !== undefined){
            do {
              fieldList.push(getField(lst, "first"));
              lst = getField(lst, "rest");
            } while (lst.dict["first"] !== undefined);

            for (var f in fieldList) {
              out.push(toRepr(getField(val, fieldList[f].s)).s);
            }

            return makeString(name.s + "(" + out.join(", ") + ")");
          }
          else {
            return makeString(name.s + "()");
          }
        }),
        "data-equals": makeFunction(function(self, other, brand, fields) {
          var b1 = applyFunc(brand, [other]);

          if(!isTrue(b1)) return b1;

          var flag = true;
          var lst = fields;

          while (lst.dict["first"] !== undefined) {
            var thisVal = getField(self, getField(lst, "first").s);
            var otherVal = getField(other, getField(lst, "first").s);

            flag = flag && applyFunc(getField(thisVal, "_equals"), [otherVal]).b;
            lst = getField(lst, "rest");
          }
        }),
        error: error
      }),
      runtime: {
        makeNumber: makeNumber,
        makeString: makeString,
        makeBool: makeBool,
        makeFunction: makeFunction,
        makeMethod: makeMethod,
        makeObject: makeObject,

        isBase: isBase,
        isNumber: isNumber,
        isString: isString,
        isBool: isBool,
        isFunction: isFunction,
        isMethod: isMethod,
        isObject: isObject,
        isMutable: isMutable,
        isTrue: isTrue,

        "is-function": makePredicate(isFunction),
        "is-method": makePredicate(isMethod),
        "is-object": makePredicate(isObject),
        "is-number": makePredicate(isNumber),
        "is-bool": makePredicate(isBool),
        "is-string": makePredicate(isString),
        "is-mutable": makePredicate(isMutable),

        applyFunc: applyFunc,
        equal: equal,
        getField: getField,
        getRawField: getRawField,
        getMutableField: getMutableField,
        getTestPrintOutput: function(val) {
          return testPrintOutput + toRepr(val).s;
        },
        NormalResult: NormalResult,
        FailResult: FailResult,
        makeNormalResult: makeNormalResult,
        makeFailResult: makeFailResult,
        toReprJS: toRepr,
        PyretException: PyretException,
        makePyretException: makePyretException,
        unwrapException: unwrapException,
      }
    }
  }

  return {
    makeRuntime: makeRuntime
  };
})();