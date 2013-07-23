#lang racket/gui

;; This sketch comes from Matthias Felleisen:
;; http://lists.racket-lang.org/users/archive/2013-April/057407.html

(require
  2htdp/private/world
  2htdp/image
  "../runtime.rkt"
  "../string-map.rkt"
  "../ffi-helpers.rkt")
(provide (rename-out [export %PYRET-PROVIDE]))

;; -----------------------------------------------------------------------------
;; small adapter 
(define do-nothing-thunk (lambda () (lambda _ (first _))))
(define (my-bb world0 ht)
  (lambda ()
    (new world% 
         (world0 world0)
         (on-draw    (hash-ref ht 'to-draw))
         (on-tick    (hash-ref ht 'on-tick do-nothing-thunk))
         (on-mouse   (hash-ref ht 'on-mouse do-nothing-thunk))
         (on-key     (hash-ref ht 'on-key do-nothing-thunk))
         (record?    (hash-ref ht 'record #f))
         (stop-when  (hash-ref ht 'stop-when (lambda _ (displayln _) (lambda _ #f))))
         (state      (hash-ref ht 'state #f))
         (check-with (hash-ref ht 'check-with (lambda _ (lambda _ #t))))
         (on-release (hash-ref ht 'on-release do-nothing-thunk))
         (on-pad     (hash-ref ht 'on-pad #f))
         (name       (hash-ref ht 'name "no  name"))
         (register   (hash-ref ht 'register #f))
         (on-receive (hash-ref ht 'on-receive do-nothing-thunk))
         )))

;; (-> Object) -> Any
(define (run-it o)
  (define esp (make-eventspace))
  (define thd (eventspace-handler-thread esp))
  (with-handlers ((exn:break? (lambda (x) (break-thread thd))))
    (define obj:ch (make-channel))
    (parameterize ([current-eventspace esp])
      (queue-callback (lambda () (displayln o) (channel-put obj:ch (o)))))
    (send (channel-get obj:ch) last)))

(define (big-bang . args)
    (define (wrap-for-racket-callback k f)
      (cond
        [(equal? k "to-draw")
         (lambda (world) (p:p-opaque-val ((p:p-base-app f) world)))]
        [(equal? k "stop-when")
         (lambda (world) (ffi-unwrap ((p:p-base-app f) world)))] 
        [(equal? k "on-key")
         (lambda (world key) ((p:p-base-app f) world (ffi-wrap key)))]
        [(equal? k "on-mouse")
         (lambda (world x y type)
          (define event-obj (p:mk-object (make-string-map (list 
            (cons "x" (ffi-wrap x))
            (cons "y" (ffi-wrap y))
            (cons "type" (ffi-wrap type))))))
          ((p:p-base-app f) world event-obj))]
        [(equal? k "on-tick")
         (lambda (world) ((p:p-base-app f) world))]
        [else (raise (p:pyret-error p:dummy-loc "big-bang-no-impl"
                      (format "No implementation for big-bang handler ~a" k)))]))
    (match (second args)
      [(p:p-object _ d _ _)
       (define hash-for-bb
         (make-hash
          (string-map-map
            d
            (lambda (k v) (cons (string->symbol k)
                                (wrap-for-racket-callback k (string-map-ref d k)))))))
       (define my-world (my-bb (first args) hash-for-bb))
         (run-it my-world)]
      [v (raise (p:pyret-error p:dummy-loc "big-bang-non-object"
                     (format "Non-object given to big bang: ~a" (p:to-string v))))]))

(define big-bang-pfun (p:mk-fun-nodoc-slow big-bang))

(define export (p:mk-object
  (make-string-map (list (cons "big-bang" big-bang-pfun)))))
