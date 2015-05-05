import os
import sys

"""
A thin wrapper of redo.
"""

target = sys.argv[1]
base = sys.argv[2]
temp = sys.argv[3]


def output(mode='w'):
    return open(sys.argv[3], mode)


class RedoCommand(object):

    def __init__(self, command_name, filenames, kw_filenames):
        self.command_name = command_name
        self.filenames = (filenames, kw_filenames)
        self.run()

    @classmethod
    def map_list_or_dict(cls, value, f):
        """(Recursively) map the values of a list, dict or tuple., applying
        `f` on all values that are not list, dict or tuple. """
        if type(value) == list:
            return [ cls.map_list_or_dict(value0, f)
                     for value0 in value ]
        elif type(value) == dict:
            return { key: cls.map_list_or_dict(value0, f)
                     for key, value0 in value.items() }
        elif type(value) == tuple:
            return tuple(cls.map_list_or_dict(value0, f)
                         for value0 in value)
        else:
            return f(value)

    def run(self):
        all_filenames = []
        self.map_list_or_dict(self.filenames, all_filenames.append)
        all_filenames_str = ' '.join('"{}"'.format(filename)
                                     for filename in all_filenames)
        command = self.command_name + ' ' + all_filenames_str
        os.system(command)

    def __enter__(self):
        self.files = self.map_list_or_dict(self.filenames, lambda f: open(str(f)))
        (files, kw_files) = self.files
        if len(files) and len(kw_files):
            return (files, kw_files)
        elif len(files):
            return files
        elif len(kw_files):
            return kw_files

    def __exit__(self, type_, value, traceback):
        self.map_list_or_dict(self.files, lambda f: f.close())

def ifchange(*filenames, **kwfilenames):
    return RedoCommand('redo-ifchange', filenames, kwfilenames)

def ifcreate(*filenames, **kwfilenames):
    return RedoCommand('redo-ifcreate', filenames, kwfilenames)
