#lang pyret

import ast as A
import json as J
import format as format

provide *

fun make-checker-name(name): "is-" + name;

fun flatten(list-of-lists :: List):
  for fold(biglist from [], piece from list-of-lists):
    biglist + piece
  end
end

fun binding-ids(stmt):
  fun variant-ids(variant):
    cases(A.Variant) variant:
      | s_variant(_, name, _, _) => [name, make-checker-name(name)]
      | s_singleton-variant(_, name, _, _) => [name, make-checker-name(name)]
    end
  end
  cases(A.Expr) stmt:
    | s_let(_, b, _) => [b.id]
    | s_var(_, b, _) => [b.id]
    | s_graph(_, bindings) => flatten(bindings.map(binding-ids))
    | s_data(_, name, _, _, variants, _, _) =>
      [name] + flatten(variants.map(variant-ids))
    | else => []
  end
end

fun block-ids(b :: A.is-s_block):
  cases(A.Expr) b:
    | s_block(_, stmts) => flatten(stmts.map(binding-ids))
    | else => raise("Non-block given to block-ids")
  end
end

fun toplevel-ids(program :: A.Program):
  cases(A.Program) program:
    | s_program(_, _, b) => block-ids(b)
    | else => raise("Non-program given to toplevel-ids")
  end
end

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

fun program-to-cps-js(ast, runtime-ids):
  cases(A.Program) ast:
    # import/provide ignored
    | s_program(_, _, block) =>
      cases(A.Expr) block :
        | s_block(l, stmts) =>

          bindings = for list.fold(bs from "", id from ["nothing"] + runtime-ids):
            bs + format("var ~a = NAMESPACE.get('~a');\n", [js-id-of(id), id])
          end

          ids = block-ids(block)
          namespace-fields = ids.map(fun(id): A.s_data_field(l, A.s_str(l, id), A.s_id(l, id));)
          fun make-final-object(val):
            A.s_obj(l, [
                A.s_data_field(l, A.s_str(l, "value"), val),
                A.s_data_field(l, A.s_str(l, "namespace"), A.s_obj(l, namespace-fields))
              ])
          end
          stmts-for-cps = if stmts.length() == 0:
              [make-final-object(A.s_id(l, "nothing"))]
            else:
              fun sequence-wrap-last(ss):
                cases(list.List) ss:
                  | link(f, r) =>
                    cases(list.List) r:
                      | empty =>
                        if A.is-s_let(f) or A.is-s_var(f):
                          [f, make-final-object(A.s_id(l, "nothing"))]
                        else:
                          [make-final-object(f)]
                        end
                      | link(_, _) => [f] + sequence-wrap-last(r)
                    end
                end
              end
              sequence-wrap-last(stmts)
            end
          block-for-cps = A.s_block(l, stmts-for-cps)
          ids-to-export = toplevel-ids(ast)
          export-fields = for list.fold(export from "", id from ids-to-export):
            export + format("EXPORT_NAMESPACE = EXPORT_NAMESPACE.set(\"~a\", ~a)\n",
              [id, js-id-of(id)])
          end
          # function(R, N, success, fail)
          # function(R, N, conts)
          # $K is { success : NormalResult -> Undef, failure : FailResult -> Undef }
          format("(function(RUNTIME, NAMESPACE, $K) {
            try {
              ~a
              var RESULT;
              (function() {
                var k = RUNTIME.makeFunction(function(RESULT) {
                    var namespace = RUNTIME.getField(RESULT, 'namespace');
                    var value = RUNTIME.getField(RESULT, 'value');
                    // TODO(joe): Relying on the representation here to get off
                    // the ground, via the pyretToJSDict endpoint.  Need to codify
                    // namespaces and their interaction with runtime precisely
                    var EXPORT_NAMESPACE = Namespace(RUNTIME.pyretToJSDict(namespace));
                    $K.success(RUNTIME.makeNormalResult(value, EXPORT_NAMESPACE));
                  });
                var f = RUNTIME.makeFunction(function(ERR) {
                    $K.failure(RUNTIME.makeFailResult(ERR));
                  });
                (function() { return ~a})().app(k);
              })();
            } catch(e) {
              $K.failure(RUNTIME.makeFailResult(e));
            }
          })", [bindings, expr-to-js(cps(block-for-cps))])
      end
  end
end


fun program-to-js(ast, runtime-ids):
  cases(A.Program) ast:
    # import/provide ignored
    | s_program(_, _, block) =>
      cases(A.Expr) block :
        | s_block(_, stmts) =>
          bindings = for list.fold(bs from "", id from runtime-ids):
            bs + format("var ~a = NAMESPACE.get('~a');\n", [js-id-of(id), id])
          end
          program-body = if stmts.length() == 0:
            "RESULT = NAMESPACE.get('nothing');"
          else:
            fun sequence-assign-last(ss):
              cases(list.List) ss:
                | link(f, r) =>
                  cases(list.List) r:
                    | empty =>
                      fun ends-in-bind(e):
                        format("~a;\nRESULT = NAMESPACE.get('nothing');", [expr-to-js(f)])
                      end
                      cases(A.Expr) f:
                        | s_let(_, _, _) => ends-in-bind(f)
                        | s_var(_, _, _) => ends-in-bind(f)
                        | else => format("RESULT = ~a;", [expr-to-js(f)])
                      end
                    | link(_, _) =>
                      format("~a;\n", [expr-to-js(f)]) + sequence-assign-last(r)
                  end
              end
            end
            sequence-assign-last(stmts)
          end
          ids-to-export = toplevel-ids(ast)
          export-fields = for list.fold(export from "", id from ids-to-export):
            #MAYBE should add a ';' at the end
            export + format("EXPORT_NAMESPACE = EXPORT_NAMESPACE.set(\"~a\", ~a)\n",
              [id, js-id-of(id)])
          end
          #MAYBE RUNTIME.runtime.makeNormalResult
          format("(function(RUNTIME, NAMESPACE) {
            try {
              ~a
              var RESULT;
              var EXPORT_NAMESPACE = Namespace({});
              (function() {
                ~a
                ~a
              })();
              return RUNTIME.makeNormalResult(RESULT, EXPORT_NAMESPACE);
            } catch(e) {
              return RUNTIME.makeFailResult(e);
            }
          })", [bindings, program-body, export-fields])
      end
  end
where:
  program-to-js(A.parse-tc("
  ", "test", {check : false, env : []}), []) is ""
end

fun do-block(str):
  format("(function() { ~a })()", [str])
end

fun arg(l, name): A.s_bind(l, name, A.a_blank);
fun lam(l, args, body): A.s_lam(l, [], args, A.a_blank, "anon lam", body, A.s_block(l, []));
fun mtd(l, args, body): A.s_method(l, args, A.a_blank, "anon method", body, A.s_block(l, []));
app = A.s_app

K = "$k"
fun mk-K(): gensym("$k");

fun cps(ast):
  # punt can be used when you don't know how to CPS yet
  fun punt():
    l = ast.l
    lam(l, [arg(l, K)], A.s_app(l, A.s_id(l, K), [ast]));
  id = A.s_id
  cases(A.Expr) ast:
    | s_block(l, pre-stmts) =>
      stmts = if pre-stmts.length() == 0: [A.s_id(l, "nothing")] else: pre-stmts;
      ids = block-ids(ast)
      vars = ids.map(fun(v): A.s_var(l, A.s_bind(l, v, A.a_blank), A.s_id(l, "nothing"));)

      cont = for fold(
            k from fun(e): A.s_app(l, cps(e), [A.s_id(l, K)]) end,
            s from stmts.take(stmts.length() - 1).reverse()):
        fun(e): A.s_app(l, cps(s), [lam(l, [arg(l, "ignored")], k(e))]);;

      body = lam(l, [arg(l, K)], cont(stmts.last()))

      A.s_block(l, vars + [body])
    | s_app(l, f, es) =>
      if es.length() == 1:
        lam(l, [arg(l, K)],
          app(l, cps(f), [lam(l, [arg(l, "$fv")],
            app(l, cps(es.first), [lam(l, [arg(l, "$argv")],
              app(l, id(l, "$fv"), [id(l, K), id(l, "$argv")]))]))]))
      else:
        punt()
        #need to care about generate string names for args
        mycont = for fold(cont from app(l, id(l, "$fv"), [id(l, K)] + ["argv#"]), e from es):
          app(l, cps(e), lam(l, [arg(l, "$argv#")], cont))
        end
        lam(l, [arg(l, K)],
          app(l, cps(f), [lam(l, [arg(l, "$fv")], mycont)]))
      end

    # My own try to CPS things:
    | s_user_block(l, body) => cps(s_block(l, body))

    | s_assign(l, id, value) => lam(l, [arg(l, K)], app(l, id(l, K), ast))

    | s_if_else(l, branches, _else) => 
      fun cps-branch(branch):
        IfBranch(branch.test, cps(branch.body))
      end
      s_if_else(l, branches.map(cps-branch), cps(_else)) 

    | s_try(l, body, id, _except) => s_try(l, cps(body), id, cps(_except)) 

    | s_lam(l, _, args, _, _, body, _) => 
      lam(l, [arg(l, K)], 
        app(l, id(l, K), 
          lam(l, args + [arg(l, "dyn-k")],
            app(l, cps(b), id(l, "dyn-k")))))

    | s_method =>
      mtd(l, [arg(l, K)],
        app(l, id(l, K), 
          lam(l, args + [arg(l, "dyn-k")],
            app(l, cps(b), id(l, "dyn-k")))))

    | s_obj(_, fields) => lam(l, [arg(l, K)], app(l, id(l, K), ast))

    | s_extend(_, super, fields) => lam(l, [arg(l, K)], app(l, id(l, K), ast))

    | s_colon_bracket(_, obj, fields) => lam(l, [arg(l, K)], app(l, id(l, K), ast))

    | s_get_bang(_, obj, field) => lam(l, [arg(l, K)], app(l, id(l, K), ast))

    | s_update(_, super, fields) => lam(l, [arg(l, K)], app(l, id(l, K), ast))

    | s_bool(l, b) => lam(l, [arg(l, K)], app(l, id(l, K), ast))

    | s_str(l, s) => lam(l, [arg(l, K)], app(l, id(l, K), ast)) 
    
    | s_id(l, s) => lam(l, [arg(l, K)], app(l, id(l, K), ast))
    # End

    # Cheating a little here: Since we explicitly lift the block variables
    # above, we just turn lets and vars into assignment statements, and rely
    # on the well-formedness checking that's already happened
    | s_let(l, b, e) => cps(A.s_assign(l, b.id, e))
    | s_var(l, b, e) => cps(A.s_assign(l, b.id, e))
    | s_num(l, n) =>
      lam(l, [arg(l, K)], A.s_app(l, A.s_id(l, K), [A.s_num(l, n)]))
    | else => punt()
  end
end

fun expr-to-js(ast):
  cases(A.Expr) ast:
    | s_block(_, stmts) =>
      if stmts.length() == 0:
        "NAMESPACE.get('nothing')"
      else:
        fun sequence-return-last(ss):
          cases(list.List) ss:
            | link(f, r) =>
              cases(list.List) r:
                | empty => format("return ~a;", [expr-to-js(f)])
                  fun ends-in-bind(e):
                    format("~a;\nreturn NAMESPACE.get('nothing');", [expr-to-js(f)])
                  end
                  cases(A.Expr) f:
                    | s_let(_, _, _) => ends-in-bind(f)
                    | s_var(_, _, _) => ends-in-bind(f)
                    | else => format("return ~a;", [expr-to-js(f)])
                  end
                | link(_, _) =>
                  format("~a;", [expr-to-js(f)]) + sequence-return-last(r)
              end
          end
        end
        format("(function(){~a})()", [sequence-return-last(stmts)])
      end

    | s_num(_, n) =>
      format("RUNTIME.makeNumber(~a)", [n])
    | s_app(_, f, args) =>
      format("~a.app(~a)", [expr-to-js(f), args.map(expr-to-js).join-str(",")])
    | s_obj(_, fields) =>
      fun member-to-js(m):
        cases(A.Member) m:
          | s_data_field(_, key, val) =>
            cases(A.Expr) key:
              | s_str(_, s) => format("~s: ~a", [s, expr-to-js(val)])
              | else => raise("Don't know how to handle non-string key: " + torepr(key))
            end
          | else => raise("Don't know how to handle case in member-to-js: " + torepr(m))
        end
      end
      format("RUNTIME.makeObject({ ~a })", [fields.map(member-to-js).join-str(",")])
    | s_bracket(_, obj, f) =>
      cases (A.Expr) f:
        | s_str(_, s) => format("RUNTIME.getField(~a, '~a')", [expr-to-js(obj), s])
        | else => raise("Non-string lookups not supported")
      end
    | s_id(_, id) => js-id-of(id)
    | s_let(_, bind, value) => format("var ~a = ~a;", [js-id-of(bind.id), expr-to-js(value)])
    | s_var(_, bind, value) => format("var ~a = ~a;", [js-id-of(bind.id), expr-to-js(value)])
    | s_assign(_, id, value) => format("(~a = ~a)", [js-id-of(id), expr-to-js(value)])
    | s_lam(_, _, binds, _, _, body, _) =>
      names = binds.map(fun(b): b.id end).map(js-id-of)
      format("RUNTIME.makeFunction(function(~a) {\n return ~a \n })", [names.join-str(","), expr-to-js(body)])
    | else => do-block(format("throw new Error('Not yet implemented ~a')", [ast.label()]))
  end
end

