# File Manager CLI

Simple file manager implemented in Node.js (Streams, FS, OS info, hash, Brotli compress/decompress).

## Requirements

- Node.js v24.x.x (24.14.0 or higher)
- No external dependencies

## How to run

```bash
npm install
npm run start -- --username=YourName

### On start you should see:

Welcome to the File Manager, YourName!
You are currently in /home/your_user
>
### Exit commands:
.exit
Ctrl+C

## Supported commands
### Navigation

up
Go up from current directory (not higher than root).

cd path_to_directory
Change current directory (relative or absolute path).

ls
Show list of files and folders in current directory.
Output is sorted: directories first, then files.

### File operations

cat path_to_file — read file and print its content (Readable stream)

add new_file_name — create empty file in current directory

mkdir new_directory_name — create new directory in current directory

rn path_to_file new_filename — rename file (content stays the same)

cp path_to_file path_to_new_directory — copy file (Readable + Writable streams)

mv path_to_file path_to_new_directory — move file (copy via streams, then delete original)

rm path_to_file — delete file

### OS info (os)

os --EOL — print default system End-Of-Line

os --cpus — print number of CPUs and info about each

os --homedir — print home directory

os --username — print current system user name

os --architecture — print CPU architecture

### Hash

hash path_to_file — calculate SHA-256 hash of the file and print it

### Compression (Brotli)

compress path_to_file path_to_destination
Compress file using Brotli (Streams API).
If path_to_destination is a directory, result file is created inside it with .br extension.

decompress path_to_file path_to_destination
Decompress previously compressed file using Brotli (Streams API).
If path_to_destination is a directory, result file is created inside it with .br removed from the name.

#### How to verify compress/decompress (NB from task)
Create file and add some content
> add demo_file.txt

Open demo_file.txt in VS Code and wright, for example:
Hello from File Manager!
Second line.

Compress the file
> mkdir out
> compress demo.txt out

Decompress to another directory
> mkdir check
> decompress out/demo.txt.br check


## Known limitations

- **No file editing inside the manager**  
  The file manager does not provide commands to edit file content.  
  Files are created with `add` as empty, and you can edit them using any external editor (e.g. VS Code) or standard terminal tools.

- **`compress` / `decompress` do not overwrite existing files**  
  When the destination file already exists, `compress` and `decompress` use write streams with exclusive flag (`wx`), so the operation fails and results in `Operation failed` instead of silently overwriting the file.  
  To run the operation again, either:
  - remove the existing target file first, or  
  - specify a different destination path.

- **`mv` is implemented as “copy + delete”**  
  The `mv` command is implemented via copying the file with Readable/Writable streams and then removing the original file with `rm`.  
  If copying fails, the original file is not deleted.

- **No recursive directory operations**  
  All file operations (`cp`, `mv`, `rm`, `hash`, `compress`, `decompress`) work with **files only**, not directories.  
  Attempting to use these commands on a directory will result in `Operation failed`.
