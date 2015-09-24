#!/usr/bin/env python3
import redo

project, = redo.snippets

redo.delegate('{}.evaluations.json'.format(project))
