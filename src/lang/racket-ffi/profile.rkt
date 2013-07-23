#lang racket

;; This sketch comes from Matthias Felleisen:
;; http://lists.racket-lang.org/users/archive/2013-April/057407.html

(require
  profile
  "../runtime.rkt"
  "../string-map.rkt"
  "../ffi-helpers.rkt")
(provide (rename-out [export %PYRET-PROVIDE]))


(define (profile-wrapper pyret-fun)
  (define (wrapped)
    ((p:p-base-app pyret-fun)))
  (define start (current-milliseconds))
  (define result (profile-thunk wrapped #:threads #t #:delay 0.01 #:repeat 3))
  (define end (current-milliseconds))
  (printf "Wall time for profiled code was: ~ams\n" (- end start))
  result)

(define profile-pfun (p:mk-fun-nodoc-slow profile-wrapper))

(define export (p:mk-object
  (make-string-map (list (cons "profile" profile-pfun)))))

