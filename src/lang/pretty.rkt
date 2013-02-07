#lang racket/base

(require
  racket/match
  racket/string
  racket/function
  "ast.rkt")

(provide
  pretty
  pretty-ann)

(define increase-indent (curry + 2))

(define (vary-pretty ast ind)
  (define pretty (curryr vary-pretty ind))
  (define indent (make-string ind #\space))
  (define next-indent (make-string (increase-indent ind) #\space))
  (define (pretty-bind b)
    (match b
      [(s-bind _ id ann)
       (format "~a :: ~a" id (pretty-ann ann))]))
  (define (pretty-member ast)
    (match ast
      [(s-data-field s name value)
       (format "[~a] : ~a" (pretty name) (pretty value))]))
  (match ast
    [(s-block s stmts)
     (define strs (map pretty stmts))
     (string-join strs (format "\n~a" indent))]
    [(s-var s bnd val)
     (format "var ~a: ~a" (pretty-bind bnd) (pretty val))]
    [(s-lam s typarams args ann doc body)
     (define s-typarams (string-join (map symbol->string typarams) ", "))
     (define s-args (string-join (map pretty-bind args) ", "))
     (define s-ann (pretty-ann ann))
     (define s-body (vary-pretty (s-block s (cons (s-str s doc) (s-block-stmts body))) (increase-indent ind)))
     (format "\\(~a) ~a -> ~a:\n~a~a\n~aend"
             s-typarams
             s-args
             s-ann
             next-indent
             s-body
             indent)]
    
    [(s-method s args ann body)
     (define s-args (string-join (map pretty-bind args) ", "))
     (define s-ann (pretty-ann ann))
     (define s-body (pretty body))
     (format "method(~a) -> ~a: ~a end" s-args s-ann s-body)]

    [(s-cond s c-bs)
     (define (pretty-branch branch)
       (match branch
         [(s-cond-branch s test expr)
          (format "| ~a => ~a" (pretty test) (pretty expr))]))
     (format "cond:\n~a\nend" (string-join (map pretty-branch c-bs) "\n"))]
    
    [(s-assign s name expr)
     (format "~a := ~a" name (pretty expr))]

    [(s-app s fun args)
     (format "~a(~a)" (pretty fun) (string-join (map pretty args) ", "))]

    [(s-onion s super fields)
     (format "~a.{ ~a }"
             (pretty super)
             (string-join (map pretty-member fields) ", "))]

    [(s-obj s fields)
     (format "{ ~a }"
             (string-join (map pretty-member fields) ", "))]
    
    [(s-dot s val field)
     (format "~a.~a" (pretty val) field)] 
    
    [(s-bracket s val field)
     (format "~a.[~a]" (pretty val) (pretty field))]
    
    [(s-dot-method s obj field)
     (format "~a:~a" (pretty obj) field)]
    
    [(s-bracket-method s obj field)
     (format "~a:[~a]" (pretty obj) (pretty field))]

    [(s-num _ n) (number->string n)]
    [(s-bool _ #t) "true"]
    [(s-bool _ #f) "false"]
    [(s-str _ s) (format "\"~a\"" s)]
    [(s-id _ id) (symbol->string id)]
    
    [else (error (format "Missed a case in pretty-printing: ~a" ast))]))

(define (pretty-ann ann)
  (match ann
    [(a-name _ id) (symbol->string id)]
    [(a-arrow _ t1 t2) (format "(~a -> ~a)" (string-join (map pretty-ann t1) ", ") (pretty-ann t2))]
    [(a-blank) "Any"]
    [(a-any) "Any"]
    [(a-app _ base args) (format "~a<~a>" (pretty-ann base) (string-join (map pretty-ann args) ", "))]
    [(a-pred _ ann expr) (format "~a(~a)" (pretty-ann ann) (pretty expr))]))

(define (pretty ast) (vary-pretty ast 0))