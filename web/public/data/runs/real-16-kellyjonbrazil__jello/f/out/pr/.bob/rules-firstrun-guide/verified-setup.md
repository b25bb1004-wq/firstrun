# Verified setup for kellyjonbrazil/jello

Verified by FirstRun on 2026-09-24 at commit `b43c9b2460` on a clean `python:3.12` machine. Clone to running took 0s.

Prerequisites: Python 3.12.

## Steps

1. `jello _.foo -f data.json`
   - Kind: other
   - Expect: exits with code 0.
2. `jello '_["foo"]' -f data.json`
   - Kind: other
   - Expect: exits with code 0.
3. `echo '{"foo":"bar","baz":[1,2,3]}' | jello`
   - Kind: other
   - Expect: exits with code 0.
4. `{`
   - Kind: other
   - Expect: exits with code 0.
5. `"foo": "bar",`
   - Kind: other
   - Expect: exits with code 0.
6. `"baz": [`
   - Kind: other
   - Expect: exits with code 0.
7. `1,`
   - Kind: other
   - Expect: exits with code 0.
8. `2,`
   - Kind: other
   - Expect: exits with code 0.
9. `3`
   - Kind: other
   - Expect: exits with code 0.
10. `]`
   - Kind: other
   - Expect: exits with code 0.
11. `}`
   - Kind: other
   - Expect: exits with code 0.
12. `echo '{"foo":"bar","baz":[1,2,3]}' | jello -c`
   - Kind: other
   - Expect: exits with code 0.
13. `{"foo":"bar","baz":[1,2,3]}`
   - Kind: other
   - Expect: exits with code 0.
14. `echo '{"foo":"bar","baz":[1,2,3]}' | jello -l _.baz`
   - Kind: other
   - Expect: exits with code 0.
15. `1`
   - Kind: other
   - Expect: exits with code 0.
16. `2`
   - Kind: other
   - Expect: exits with code 0.
17. `3`
   - Kind: other
   - Expect: exits with code 0.
18. `echo '[{"foo":"bar","baz":[1,2,3]},{"fiz":"boo","buz":[4,5,6]}]' | jello -l`
   - Kind: other
   - Expect: exits with code 0.
19. `{"foo":"bar","baz":[1,2,3]}`
   - Kind: other
   - Expect: exits with code 0.
20. `{"fiz":"boo","buz":[4,5,6]}`
   - Kind: other
   - Expect: exits with code 0.
21. `echo '{"foo":"bar","baz":[1,2,3]}' | jello -s`
   - Kind: other
   - Expect: exits with code 0.
22. `_ = {}`
   - Kind: other
   - Expect: exits with code 0.
23. `_.foo = "bar"`
   - Kind: other
   - Expect: exits with code 0.
24. `_.baz = []`
   - Kind: other
   - Expect: exits with code 0.
25. `_.baz[0] = 1`
   - Kind: other
   - Expect: exits with code 0.
26. `_.baz[1] = 2`
   - Kind: other
   - Expect: exits with code 0.
27. `_.baz[2] = 3`
   - Kind: other
   - Expect: exits with code 0.
28. `cat values.yaml`
   - Kind: other
   - Expect: exits with code 0.
29. `jello -Rr '`
   - Kind: other
   - Expect: exits with code 0.
30. `echo '{"login_name": "joeuser"}' | jello 'os.getenv("LOGNAME") == _.login_name'`
   - Kind: other
   - Expect: exits with code 0.
31. `true`
   - Kind: other
   - Expect: exits with code 0.

## Known failure signatures

| If you see | Cause | Fix |
|---|---|---|
