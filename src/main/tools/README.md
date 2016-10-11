# CodeMapper tools

Code sets for conditions (events) mapped in CodeMapper can be downloaded as XLS
files from the web application.

## Manage

The script `manage.py` is used to administrating the CodeMapper database.
Operations are

- Create users
- Create projects
- Assign users to projects

Use `./manage.py --help` for a full description of functionality and options.

## Compile

The script `compile.py` is used to put together the code sets of multiple
conditions into one XLS file for easy distribution of codes to databases.

A vocabulary map is used to assign codes from a set of CodeMapper/UMLS
vocabularies to databases.

Use `./compile.py --help` for a full description of functionality and options.

## Code counts

The script `code-counts.py` connects the code counts resulting from the event
fingerprinting with the code sets generated with CodeMapper. It runs on the code
counts on all events from one database at once.

The script includes a Tk graphical user interface.

Use `./code-counts.py --help` for a full description of functionality and
options. Pyinstaller can be used to compile it into a single (windows) .exe
file.

