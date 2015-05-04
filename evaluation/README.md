# CoMap evaluation<sup>1</sup>

## Get redo

`redo` is used for building the evaluation.

- get `redo` from [https://github.com/mildred/redo.git](https://github.com/mildred/redo.git) by
```shell
git clone https://github.com/mildred/redo.git
cd redo
```
- explicitly use Python 2
```shell
sed -i 's-#!/usr/bin/env python-#!/usr/bin/env python2-' redo
```
- install it (generate debian package with `./redo deb`, or add the
directory to your PATH).

## Prepare python

```shell
virtualenv -ppython3 py3-env
source ./py3-env/bin/activate
pip install -r requirements.txt
```

## Evaluate Comap

```shell
redo
```
