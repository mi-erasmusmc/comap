import os
import sys

"""
A thin wrapper of redo.
=======================

- Simple declaration of and access to dependencies

   with redo.ifchange(file1="path/to/file1",
                      files2=["path/to/file2a", "path/to/file2b"])
           as files:
       files['file1]' # opened path/to/file1
       files['files2'][0]  # openend path/to/file2a
       files['files2'][1]  # openend path/to/file2b

  The keyword arguments might be nested lists, dictionarys and tuples.
  The return value is a dictionary with exactly the same structure as
  kwargs but with filenames replaced with files.

- Easy access to the temporary output file via

      with redo.output() as f:
         ... dump your data to `f` ...

- It provides the redo command line arguments as `redo.target`,
  `redo.base` and `redo.temp`.

"""


target = sys.argv[1]
base = sys.argv[2]
temp = sys.argv[3]


def output(mode='w'):
    """ Create a file for redo's temporary output file. """
    return open(temp, mode)


def ifchange(*args, **kwargs):
    """Run the `redo-ifchange` command on all files in **kwargs. """
    return RedoCommand('redo-ifchange', *args, **kwargs)


class RedoCommand(object):

    def __init__(self, command_name, *args, **kwargs):
        self.command_name = command_name
        assert args or kwargs, "Provide either *args or **kwargs."
        if args and kwargs:
            self.filenames = (args, kwargs)
        elif args:
            self.filenames = args
        elif kwargs:
            self.filenames = kwargs
        self.run()

    @classmethod
    def map_list_or_dict(cls, value, f):
        """(Recursively) map the values of a list, dict or tuple., applying
        `f` on all values that are not list, dict or tuple. """
        if type(value) == list:
            return [cls.map_list_or_dict(value0, f)
                    for value0 in value]
        elif type(value) == dict:
            return {key: cls.map_list_or_dict(value0, f)
                    for key, value0 in value.items()}
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
        f = lambda filename: open(str(filename))
        self.files = self.map_list_or_dict(self.filenames, f)
        return self.files

    def __exit__(self, type_, value, traceback):
        self.map_list_or_dict(self.files, lambda f: f.close())


