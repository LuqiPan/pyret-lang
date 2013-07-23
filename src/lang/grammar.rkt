#lang ragg

program: imports block

imports: (import-stmt|provide-stmt)*

import-name: NAME
import-string: STRING
import-stmt: "import" (import-name | import-string) "as" NAME
provide-stmt: "provide" stmt "end" | "provide" "*"

block: stmt*

stmt: var-expr | let-expr | fun-expr | data-expr | binop-expr
    | assign-expr | when-expr

binop: "+"  | "-"  | "*"  | "/"  | "<="  | ">="  | "==" | "<>"  | "<"  | ">" | "and" | "or"
    
binop-expr: expr | not-expr | binop-expr binop binop-expr

not-expr: "not" expr

# paren-exprs must be preceded by a space, so as not be be confused with
# function application
paren-expr: PARENSPACE binop-expr ")"
    
expr: obj-expr | list-expr | app-expr | id-expr | prim-expr
    | dot-expr | bracket-expr | colon-expr | colon-bracket-expr
    | case-expr | lambda-expr | method-expr | extend-expr | left-app-expr
    | for-expr | paren-expr | try-expr | if-expr | cases-expr


id-expr: NAME

assign-expr: NAME ":=" binop-expr

prim-expr:
   num-expr
 | bool-expr
 | string-expr
num-expr: NUMBER | "-" NUMBER
bool-expr: "true" | "false"
string-expr: STRING
                    
var-expr: "var" arg-elt "=" binop-expr
let-expr: arg-elt "=" binop-expr

app-arg-elt: binop-expr ","
app-args: PARENNOSPACE [app-arg-elt* binop-expr] ")"
app-expr: expr app-args

arg-elt: NAME ["::" ann]
list-arg-elt: arg-elt ","
args: (PARENSPACE|PARENNOSPACE) [list-arg-elt* arg-elt] ")"

list-ty-param: NAME ","
ty-params:
  ["<" list-ty-param* NAME ">"]

return-ann: ["->" ann]

fun-header: ty-params NAME args return-ann

fun-expr: "fun" fun-header ":" doc-string block check-clause "end"

lambda-expr: "fun" ty-params [args] return-ann ":" doc-string block check-clause "end"

method-expr: "method" args return-ann ":" doc-string block check-clause "end"

doc-string: ["doc:" STRING]

check-clause: ["check:" block]

when-expr: "when" binop-expr ":" block "end"

cases-branch: "|" NAME [args] "=>" block
cases-expr: "cases" (PARENSPACE|PARENNOSPACE) expr ")" expr ":" cases-branch* ["|" "else" "=>" block] "end"

case-branch: "|" binop-expr "=>" block
case-expr: "case:" case-branch* "end"

else-if: "else if" binop-expr ":" block
if-expr: "if" binop-expr ":" block else-if* ["else:" block] "end"

try-expr: "try:" block "except" (PARENSPACE|PARENNOSPACE) arg-elt ")" ":" block "end"
   
key: NAME | "[" binop-expr "]"
field:
   key ":" binop-expr
 | key args return-ann ":" doc-string block check-clause "end"
list-field: field ","
fields: list-field* field [","]

# list-field is here because it works better with syntax-matching -
# there's a syntax sub-list for list-field that we can grab hold of
obj-expr:
   "{" fields "}"
 | "{" "}"

list-elt: binop-expr ","
list-expr: "[" [list-elt* binop-expr] "]"

extend-expr: expr "." "{" fields "}"
             # if we want it, we can add | expr "." "{" expr "}"

dot-expr: expr "." NAME
bracket-expr: expr "." "[" binop-expr "]"

left-app-fun-expr: id-expr | id-expr "." NAME
left-app-expr: expr "^" left-app-fun-expr app-args

colon-expr: expr ":" NAME
colon-bracket-expr: expr ":" "[" binop-expr "]"

data-with: ["with:" fields]
data-variant: "|" NAME args data-with | "|" NAME data-with
data-sharing: ["sharing:" fields]
data-expr: "data" NAME ty-params ":" data-variant+ data-sharing check-clause "end"

for-bind: arg-elt "from" binop-expr
for-bind-elt: for-bind ","
for-expr: "for" expr PARENNOSPACE [for-bind-elt* for-bind] ")" return-ann ":" block "end"
           
ann: name-ann | record-ann | arrow-ann | app-ann | pred-ann | dot-ann

name-ann: NAME
record-ann: "{" [list-ann-field* ann-field] "}"
          | "{" "}"
ann-field: NAME ":" ann
list-ann-field: ann-field ","

arrow-ann-elt: ann ","
arrow-ann: (PARENSPACE|PARENNOSPACE) arrow-ann-elt* ann "->" ann ")"

app-ann-elt: ann ","
app-ann: (name-ann|dot-ann) "<" app-ann-elt* ann ">"

pred-ann: ann (PARENSPACE|PARENNOSPACE) binop-expr ")"

dot-ann : NAME "." NAME
