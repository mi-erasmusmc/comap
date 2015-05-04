import os
import sys

"""
A thin wrapper of redo.
"""

target = sys.argv[1]
base = sys.argv[2]
temp = sys.argv[3]

class RedoCommand(object):

    def __init__(self, command_name, filenames):
        self.command_name = command_name
        self.filenames = filenames
        self.run()

    def run(self):
        quote = '"{}"'.format
        def flatten(file_or_files):
            if type(file_or_files) in [list, tuple]:
                return [ name for children in file_or_files for name in flatten(children) ]
            else:
                return [ file_or_files ]
        filenames = ' '.join(quote(f) for f in flatten(self.filenames))
        command = self.command_name + ' ' + filenames
        os.system(command)

    def __enter__(self):
        def open_files(file_or_files):
            if type(file_or_files) in [list, tuple]:            
                res = []
                for children in file_or_files:
                    res.append(open_files(children))
                return res
            else:
                return open(file_or_files)
        self.files = open_files(self.filenames)
        return self.files

    def __exit__(self, type_, value, traceback):
        def close_files(file_or_files):
            if type(file_or_files) == list:
                for children in file_or_files:
                    close_files(children)
            else:
                file_or_files.close()
        close_files(self.files)

def ifchange(*filenames):
    return RedoCommand('redo-ifchange', filenames)

def ifcreate(*filenames):
    return RedoCommand('redo-ifcreate', filenames)
