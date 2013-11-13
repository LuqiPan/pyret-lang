#lang pyret

# BUILTINS

fun identical(obj1, obj2):
  if has-field(obj1, "eq") and has-field(obj2, "eq"):
    obj1.eq(obj2)
  else:
    raise("Identical got values that weren't created by data: " + torepr(obj1) + " and " + torepr(obj2))
  end
end

fun mklist(obj):
  doc: "Creates a List from something with `first` and `rest` fields, recursively"
  if obj.is-empty: empty
  else:            link(obj.first, mklist(obj.rest))
  end
end

fun keys(obj):
  doc: "Returns a List of the keys of an object, as strings"
  mklist(prim-keys(obj))
end

fun has-field(obj, name):
  doc: "Returns true if the object has a field with the name specified"
  prim-has-field(obj, name)
end

fun num-keys(obj):
  doc: "Returns the Number of fields in an object"
  prim-num-keys(obj)
end

fun Eq():
  b = brander()
  {
    extend: fun(obj):
        obj.{eq(self, other): b.test(self) and b.test(other) end}
      end,
    brand: fun(obj): b.brand(obj) end
  }
end

builtins = {
  identical: identical,
  keys: keys,
  has-field: has-field,
  mklist: mklist,
  equiv: equiv,
  data-to-repr: data-to-repr,
  data-equals: data-equals,
  Eq: Eq
}

#LIST
data List:
  | empty with:
    length(self): 0 end,
    append(self, other): other end,
    _torepr(self): "[]" end,
    map(self, f) -> List: empty end
  | link(first, rest :: List) with:
    length(self): 1 + self.rest.length() end,
    append(self, other): self.first^link(self.rest.append(other)) end,
    _torepr(self):
      "[" +
        for raw-fold(combined from torepr(self:first), elt from self:rest):
          combined + ", " + torepr(elt)
        end
      + "]"
    end,
    map(self, f): f(self.first)^link(self.rest.map(f)) end
sharing:
  _plus(self, other): self.append(other) end
end

fun raw-fold(f, base, lst :: List):
  if is-empty(lst):
    base
  else:
    raw-fold(f, f(base, lst:first), lst.rest)
  end
end

fun map(f, lst :: List):
  doc: "Returns a list made up of f(elem) for each elem in lst"
  if is-empty(lst):
    empty
  else:
    f(lst.first)^link(map(f, lst.rest))
  end
end

list = {
  link: link,
  empty: empty,
  map: map
}
