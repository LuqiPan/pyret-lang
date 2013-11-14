#lang pyret

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
  Eq: Eq
}

data List:
  | empty with:
    length(self): 0 end,
    _torepr(self): "[]" end,
    append(self, other): other end
  | link(first, rest :: List) with:
    length(self): 1 + self.rest.length() end,
    append(self, other): self.first^link(self.rest.append(other)) end
sharing:
  _plus(self, other): self.append(other) end
end

list = {
  link: link,
  empty: empty
}

checkers = {}
