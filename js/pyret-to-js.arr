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
        bs + format("var ~a = RUNTIME['~a'];\n", [js-id-of(id), id])
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
                  format("~a;\n", [expr-to-js(f)]) + sequence-return-last(r)
              end
          end
        end
        format("(function(){\n ~a \n})()", [sequence-return-last(stmts)])
      end
    | s_user_block(_, body) =>
      expr-to-js(body)
    | s_var(_, name, value) =>
      format("~a = ~a;\n",[js-id-of(name), expr-to-js(value)])
    | s_let(_, name, value) =>
      #not sure
      nothing

    | s_assign(_, id, value) =>
      #May need to verify id is in environment
      format("~a = ~a;\n",[js-id-of(id), expr-to-js(value)])
    | s_if_else(_, branches, _else) =>
      #not sure
      fun compile-if-branch(bs):
        cases(list.List) bs:
	  | link(f, r) =>
	    cases(list.List) r:
	      | empty => format("if (~a) {\n ~a }\n".[expr-to-js(f.test), expr-to-js(f.block)])
	      | link(_, _) =>
	        format("if (~a) {\n ~a }\nelse ~a",[expr-to-js(f.test), expr-to-js(f.blcok), compile-if-branch(r)])
	end
      end

    | s_try(_, body, id, _except) =>
      format("try\n {\n ~a }\n catch(~a)\n{\n ~a }\n", [expr-to-js(body), js-id-of(id), expr-to-js(_except)])
    | s_lam(_, params, args, _, doc, body, _) =>
      var default = ""
      #need more info about default arguments
      #how to define doc?
      format("function(~a) {\n ~a ~a }\n", [params.map(js-id-of).join-str(","), default, expr-to-js(body)])
    | s_method(_, args, ann, doc, body, _) =>
      #nearly identical to s_lam, but need more info
      nothing
    | s_extend(_, super, fields) =>
      #not sure
      nothing
    | s_obj(_, fields) =>
      fun js-field-init(field :: Member)
        format("this.~a = ~a", [js-id-of(field.name), expr-to-js(field.value)])
      end
      format("function() {\n ~a;\n}\n", [fields.map(js-field-init).join-str(";\n")])
    | s_app(_, f, args) =>
      format("~a.app(~a)", [expr-to-js(f), args.map(expr-to-js).join-str(",")])
    | s_id(_, id) => js-id-of(id)
    | s_num(_, n) =>
      format("RUTIME.makeNumber(~a)", [n])
    | s_bool(_, b) =>
      format("RUNTIME.makeBoolean(~a)", [b])
    | s_str(_, s) =>
      format("RUNTIME.makeString("~a")", [s])
    | s_bracket(_, obj, f) =>
      cases (A.Expr) f:
        | s_str(_, s) => format("RUNTIME.getField(~a, '~a')", [expr-to-js(obj), s])
        | else => raise("Non-string lookups not supported")
      end
    | else => do-block(format("throw new Error('Not yet implemented ~a')", [torepr(ast)]))
  end
end

