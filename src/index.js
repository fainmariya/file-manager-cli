// src/index.mjs
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import os from 'node:os';
import readline from 'node:readline/promises';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

import { stat, mkdir, rename, unlink, readdir } from 'node:fs/promises';
import { createBrotliCompress, createBrotliDecompress } from 'node:zlib';


const usernameArg = process.argv.slice(2).find(a => a.startsWith('--username='));
const USERNAME = usernameArg ? usernameArg.split('=')[1] : 'Anonymous';


let CWD = os.homedir();                     
const ROOT = path.parse(CWD).root;             
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
});


function printCwd() {
  console.log(`You are currently in ${CWD}`);
}
console.log(`Welcome to the File Manager, ${USERNAME}!`);


const invalid  = () => console.log('Invalid input');
const failed   = () => console.log('Operation failed');


function splitArgs(line) {
  
  const re = /\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*/g;
  const out = [];
  let m;
  while ((m = re.exec(line))) {
    const [, dq, sq, bare] = m;
    const t = dq ?? sq ?? bare;
    if (t !== undefined && t !== '') out.push(t);
  }
  return out;
}

const resolveTarget = (base, p) =>
  path.isAbsolute(p) ? path.normalize(p) : path.resolve(base, p);

async function isDir(p) { 
  try { 
    return (await stat(p)).isDirectory(); 
  } catch { return false; } }

async function isFile(p) {
   try { 
    return (await fsp.stat(p)).isFile(); 
  } catch { return false; } 
} 
async function ensureDir(p) { 
  if (!(await isDir(p))) throw new Error('Not directory'); 
}
const commands = {

  up: {
    validate: (a) => a.length === 0,
    run: async () => {
      if (CWD !== ROOT) CWD = path.dirname(CWD); // When using the up command, the file manager must not go above the root directory.
    },
  },

  cd: {
    validate: (a) => a.length === 1 && a[0],
    run: async ([dir]) => {
      const target = resolveTarget(CWD, dir);
      await ensureDir(target);
      CWD = target;
    },
  },

  ls: {
    validate: (a) => a.length === 0,
  run: async () => {
    const entries = await fsp.readdir(CWD, { withFileTypes: true });

    // build an array of objects containing the necessary fields
    const items = entries
      .filter(e => e.isDirectory() || e.isFile())       // only files and folders
      .map(e => ({
        Name: e.name,
        Type: e.isDirectory() ? 'directory' : 'file',
      }))
      // sort: folders first, files next, both alphabetically
      .sort((a, b) => {
        if (a.Type === b.Type) {
          return a.Name.localeCompare(b.Name);
        }
        return a.Type === 'directory' ? -1 : 1; // directories first
      });

    console.table(items); 
  },
},

  cat: {
    validate: (a) => a.length === 1,
    run: async ([p]) => {
      const src = resolveTarget(CWD, p);
      if (!(await isFile(src))) throw new Error('no file');
      await pipeline(fs.createReadStream(src, { encoding: 'utf8' }), process.stdout);
      
    },
  },

  add: {
    validate: (a) => a.length === 1,
    run: async ([name]) => {
      const dest = path.resolve(CWD, name);
      await fsp.writeFile(dest, '', { flag: 'wx' }); 
    },
  },

  mkdir: {
    validate: (a) => a.length === 1,
  run: async ([name]) => {
    const dir = path.resolve(CWD, name);
    await fsp.mkdir(dir, { recursive: false });
    console.log(`Directory '${name}' created`);
  },
  },

  rn: {
    
    validate: (a) => a.length === 1,
  run: async ([srcPath]) => {
    const src = resolveTarget(CWD, srcPath);
    const trashDir = path.resolve(CWD, '.trash');
    await fsp.mkdir(trashDir, { recursive: true });
    const dest = path.join(trashDir, `${path.basename(src)}.${Date.now()}.deleted`);
    await fsp.rename(src, dest);        
  },
  },

  cp: {
    // cp path_to_file path_to_new_directory
    
     
      validate: (a) => a.length === 2,
      run: async ([srcPath, destDir]) => {
       
        const src = resolveTarget(CWD, srcPath);    // Path to the source file
        const destBase = resolveTarget(CWD, destDir); // destination directory
    
        // check that destBase is a valid directory
        await ensureDir(destBase); // If not, it will throw an error → Operation failed.
    
        // the path of the resulting file inside the directory
        const dest = path.join(destBase, path.basename(src));
    
        
        await pipeline(
          fs.createReadStream(src),                          // Readable stream
          fs.createWriteStream(dest, { flags: 'wx' }),       // Writable stream, не перезаписываем
        );
      },
    },
    

  mv: {
    // mv path_to_file path_to_new_directory
    validate: (a) => a.length === 2,
    run: async ([srcPath, destDir]) => {
      const src = resolveTarget(CWD, srcPath);
      const destBase = resolveTarget(CWD, destDir);
      await ensureDir(destBase);
      const dest = path.join(destBase, path.basename(src));
      await pipeline(
        fs.createReadStream(src),
        fs.createWriteStream(dest, { flags: 'wx' }),
      );
      await fsp.unlink(src);
    },
  },

  rm: {
    validate: (a) => a.length === 1,
    run: async ([srcPath]) => {
      const src = resolveTarget(CWD, srcPath);
      await fsp.unlink(src);
    },
  },

  // os info
  os: {
    validate: (a) =>
      a.length === 1 &&
      ['--EOL', '--cpus', '--homedir', '--username', '--architecture'].includes(a[0]),
    run: async ([flag]) => {
      switch (flag) {
        case '--EOL':
          console.log(JSON.stringify(os.EOL));//JSON.stringify - It turns the invisible end-of-line symbol into a visible string — "\n" or "\r\n".
          break;
        case '--cpus': {
          const list = os.cpus();
          console.log(`Overall CPUs: ${list.length}`);
          list.forEach((c, i) => {
            console.log(`#${i + 1} ${c.model}, ${(c.speed / 1000).toFixed(2)} GHz`);
          });
          break;
        }
        case '--homedir':
          console.log(os.homedir());
          break;
        case '--username':
          console.log(os.userInfo().username);
          break;
        case '--architecture':
          console.log(process.arch);
          break;
      }
    },
  },

  // hash
  hash: {
    validate: (a) => a.length === 1,
    run: async ([p]) => {
      const src = resolveTarget(CWD, p);
      const hash = createHash('sha256');
      await pipeline(fs.createReadStream(src), hash);
      console.log(hash.digest('hex'));
    },
  },

  // brotli
  compress: {
    // compress path_to_file path_to_destination
    validate: (a) => a.length === 2,
    run: async ([srcPath, destPath]) => {
      const src = resolveTarget(CWD, srcPath);
      const destRes = resolveTarget(CWD, destPath);
      const outPath = (await isDir(destRes))
        ? path.join(destRes, path.basename(src) + '.br')
        : destRes;
      await pipeline(
        fs.createReadStream(src),
        createBrotliCompress(),
        fs.createWriteStream(outPath, { flags: 'wx' }),
      );
    },
  },

  decompress: {
    // decompress path_to_file path_to_destination
    validate: (a) => a.length === 2,
    run: async ([srcPath, destPath]) => {
      const src = resolveTarget(CWD, srcPath);
      const destRes = resolveTarget(CWD, destPath);
      const base = path.basename(src).replace(/\.br$/i, '');
      const outPath = (await isDir(destRes))
        ? path.join(destRes, base)
        : destRes;
      await pipeline(
        fs.createReadStream(src),
        createBrotliDecompress(),
        fs.createWriteStream(outPath, { flags: 'wx' }),
      );
    },
  },
  }







let exiting = false;
function farewell() {
  console.log(`Thank you for using File Manager, ${USERNAME}, goodbye!`);
}
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  try { farewell(); } catch {}
  try { rl.close(); } catch {}
  setTimeout(() => process.exit(code), 0);
}

process.on('SIGINT', () => shutdown(0));
rl.on('SIGINT', () => shutdown(0));
rl.on('close', () => { if (!exiting) shutdown(0); });

const runLine = async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;                 // пустой ввод просто печатаем CWD
  if (trimmed === '.exit') { shutdown(0); return; }

  const [cmd, ...args] = trimmed.split(/\s+/);
  const entry = commands[cmd];

  if (!entry || !entry.validate(args)) {
    invalid();                          // неизвестная команда или не те аргументы
    return;
  }
  try {
    await entry.run(args);              // любые ошибки исполнения → Operation failed
  } catch {
    failed();
  }
};

rl.prompt();
for await (const line of rl) {
  await runLine(line);
  printCwd();
  rl.prompt();
}
