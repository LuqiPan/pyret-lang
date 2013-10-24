#lang pyret

import ast as A
import json as J
import format as format

provide *

js-id-of = block:
  var js-ids = {}
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
  program-to-js(A.parse-tc("
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

    | s_user_block(l :: A.Loc, body :: A.Expr) =>
      expr-to-js(body)

    | s_var(l :: A.Loc, name :: A.Bind, value :: A.Expr) =>
      format("~a = ~a", [js-id-of(name.id), expr-to-js(value)])

    | s_let(l :: A.Loc, name :: A.Bind, value :: A.Expr) =>
      format("~a = ~a",[js-id-of(name.id), expr-to-js(value)])

    | s_assign(l :: A.Loc, id :: String, value :: A.Expr) =>
      format("~a = ~a", [js-id-of(id), expr-to-js(value)])

    #| s_if_else(l :: A.Loc, branches :: list.List<IfBranch>, _else :: A.Expr) =>

    #| s_try(l :: A.Loc, body :: A.Expr, id :: A.Bind, _except :: A.Expr) => nothing

    | s_lam(_, params, args, _, _, body, check) =>
      fun get-id(bind):
        js-id-of(bind.id)
      end
      format("RUNTIME.makeFunction(function(~a) { return ~a; })", [args.map(get-id).join-str(","), expr-to-js(body)])

    | s_method(l :: A.Loc, args :: list.List<A.Bind>, ann :: A.Ann, doc :: String, body :: A.Expr, check :: A.Expr) =>
      format("RUNTIME.makeMethod(function(~a) { return ~a; })", [args.map(fun (x): js-id-of(x.id) end).join-str(","), expr-to-js(body)])

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
      format("~a.extend({~a})", [expr-to-js(super), fields.map(field-to-js).join-str(",")])

    | s_bracket(_, obj, f) =>
      cases (A.Expr) f:
        | s_str(_, s) => format("RUNTIME.getField(~a, '~a')", [expr-to-js(obj), s])
        | else => raise("Non-string lookups not supported")
      end

    | s_colon_bracket(_, obj, field) =>
      cases (A.Expr) field:
        | s_str(_, s) => format("RUNTIME.getRawField(~a, '~a')", [expr-to-js(obj), s])
        | else => raise("Non-string lookups not supported")
      end

    | s_get_bang(l :: A.Loc, obj :: A.Expr, field :: String) =>
      format("RUNTIME.getMutableField(~a, '~a')", [expr-to-js(obj), field])

    | s_update(l :: A.Loc, super :: A.Expr, fields) =>
      fun field-to-js(field):
        format("'~a': ~a", [field.name.s, expr-to-js(field.value)])
      end
      format("~a.mutate({~a})", [expr-to-js(super), fields.map(field-to-js).join-str(",")])

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

