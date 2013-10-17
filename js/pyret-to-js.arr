#lang pyret

import ast as A
import json as J
import format as format

provide *

js-id-of = block:
  var js-ids = {}
  #preserve brander identifier
  js-ids := js-ids.{ ["brander"]: "brander"}
  js-ids := js-ids.{ ["is-number"]: "isNumber"}
  fun(id :: String):
    if builtins.has-field(js-ids, id):
      js-ids.[id]
    else:
      no-hyphens = id.replace("-", "_DASH_")
      safe-id = gensym(no-hyphens)
      js-ids := js-ids.{ [id]: safe-id }
      safe-id
    end
  end
end

fun program-to-js(ast, runtime-ids):
  cases(A.Program) ast:
    # import/provide ignored
    | s_program(_, _, block) =>
      bindings = for list.fold(bs from "", id from runtime-ids):
        bs + format("var ~a = RUNTIME['~a'];", [js-id-of(id), id])
      end
      format("(function(RUNTIME) {
        try {
          ~a
          return RUNTIME.makeNormalResult(~a);
        } catch(e) {
          return RUNTIME.makeFailResult(e);
        }
       })", [bindings, expr-to-js(block)])
  end
where:
  program-to-js(A.parse-tc("b = brander()
  2 is-object(b)
  ", "test", {check : false, env : []}), []) is ""
end

fun do-block(str):
  format("(function() { ~a })()", [str])
end

fun expr-to-js(ast):
  cases(A.Expr) ast:
    | s_block(_, stmts) =>
      if stmts.length() == 0:
        "RUNTIME.nothing"
      else:
        fun sequence-return-last(ss):
          cases(list.List) ss:
            | link(f, r) =>
              cases(list.List) r:
                | empty => format("return ~a;", [expr-to-js(f)])
                | link(_, _) =>
                  format("~a;", [expr-to-js(f)]) + sequence-return-last(r)
              end
          end
        end
        format("(function(){~a})()", [sequence-return-last(stmts)])
      end
    | s_user_block(_, body) =>
      expr-to-js(body)
    | s_lam(_, params, args, _, _, body, check) =>
      fun get-id(bind):
        js-id-of(bind.id)
      end
      format("RUNTIME.makeFunction(function(~a){return ~a;})",[args.map(get-id).join-str(","), expr-to-js(body)])
    | s_app(_, f, args) =>
      format("~a.app(~a)", [expr-to-js(f), args.map(expr-to-js).join-str(",")])
    | s_obj(_, fields) =>
      fun field-to-js(field):
        format("'~a': ~a", [field.name.s, expr-to-js(field.value)])
      end
      format("RUNTIME.makeObject({~a})", [fields.map(field-to-js).join-str(",")])
    | s_extend(_, super, fields) =>
      fun field-to-js(field):
        format("'~a': ~a", [field.name.s, expr-to-js(field.value)])
      end
      format("RUNTIME.getField(~a, '_extend').app({~a})", [expr-to-js(super), fields.map(field-to-js).join-str(",")])
    | s_var(_, name, value) =>
      format("~a = ~a",[js-id-of(name.id), expr-to-js(value)])
    | s_bracket(_, obj, f) =>
      cases (A.Expr) f:
        | s_str(_, s) => format("RUNTIME.getField(~a, '~a')", [expr-to-js(obj), s])
        | else => raise("Non-string lookups not supported")
      end
    | s_colon_bracket(_, obj, field) =>
      cases (A.Expr) field:
        | s_str(_, s) => format("RUNTIME.getField(~a, '~a')", [expr-to-js(obj), s])
        | else => raise("Non-string lookups not supported")
      end
    | s_let(_, name, value) =>
      format("~a = ~a",[js-id-of(name.id), expr-to-js(value)])
    | s_assign(_, id, value) =>
      format("~a = ~a",[js-id-of(id), expr-to-js(value)])
    | s_id(_, id) => 
      js-id-of(id)
    | s_num(_, n) =>
      format("RUNTIME.makeNumber(~a)", [n])
    | s_bool(_, b) =>
      format("RUNTIME.makeBool(~a)", [b])
    | s_str(_, s) =>
      format("RUNTIME.makeString('~a')", [s])
    | else => do-block(format("throw new Error('Not yet implemented ~a')", [torepr(ast)]))
  end
end

