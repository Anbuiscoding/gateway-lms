import { api } from './session';

export type Mode = 'browser-js' | 'browser-py' | 'browser-html' | 'remote' | 'none';
export interface Lang { id: string; label: string; monaco: string; mode: Mode; hello: string }

export const LANGS: Lang[] = [
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', mode: 'browser-js', hello: 'const greet = (name) => "Hello, " + name + "!";\nconsole.log(greet("Gateway"));\n' },
  { id: 'typescript', label: 'TypeScript', monaco: 'typescript', mode: 'remote', hello: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("Gateway"));\n' },
  { id: 'python', label: 'Python', monaco: 'python', mode: 'browser-py', hello: 'name = "Gateway"\nprint(f"Hello, {name}!")\n' },
  { id: 'java', label: 'Java', monaco: 'java', mode: 'remote', hello: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Gateway!");\n    }\n}\n' },
  { id: 'c', label: 'C', monaco: 'c', mode: 'remote', hello: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, Gateway!\\n");\n    return 0;\n}\n' },
  { id: 'cpp', label: 'C++', monaco: 'cpp', mode: 'remote', hello: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, Gateway!" << std::endl;\n    return 0;\n}\n' },
  { id: 'csharp', label: 'C#', monaco: 'csharp', mode: 'remote', hello: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, Gateway!");\n    }\n}\n' },
  { id: 'go', label: 'Go', monaco: 'go', mode: 'remote', hello: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Gateway!")\n}\n' },
  { id: 'rust', label: 'Rust', monaco: 'rust', mode: 'remote', hello: 'fn main() {\n    println!("Hello, Gateway!");\n}\n' },
  { id: 'php', label: 'PHP', monaco: 'php', mode: 'remote', hello: '<?php\necho "Hello, Gateway!\\n";\n' },
  { id: 'ruby', label: 'Ruby', monaco: 'ruby', mode: 'remote', hello: 'puts "Hello, Gateway!"\n' },
  { id: 'kotlin', label: 'Kotlin', monaco: 'kotlin', mode: 'remote', hello: 'fun main() {\n    println("Hello, Gateway!")\n}\n' },
  { id: 'swift', label: 'Swift', monaco: 'swift', mode: 'remote', hello: 'print("Hello, Gateway!")\n' },
  { id: 'bash', label: 'Bash', monaco: 'shell', mode: 'remote', hello: 'echo "Hello, Gateway!"\nfor i in 1 2 3; do echo "step $i"; done\n' },
  { id: 'sql', label: 'SQL', monaco: 'sql', mode: 'remote', hello: 'CREATE TABLE learners (name TEXT, score INT);\nINSERT INTO learners VALUES ("Arun", 91), ("Divya", 84);\nSELECT name, score FROM learners ORDER BY score DESC;\n' },
  { id: 'r', label: 'R', monaco: 'r', mode: 'remote', hello: 'scores <- c(72, 88, 95, 64)\ncat("mean:", mean(scores), "\\n")\n' },
  { id: 'dart', label: 'Dart', monaco: 'dart', mode: 'remote', hello: 'void main() {\n  print("Hello, Gateway!");\n}\n' },
  { id: 'lua', label: 'Lua', monaco: 'lua', mode: 'remote', hello: 'print("Hello, Gateway!")\n' },
  { id: 'html', label: 'HTML / CSS', monaco: 'html', mode: 'browser-html', hello: '<!doctype html>\n<h1 style="font-family:sans-serif;color:#078fe8">Hello, Gateway!</h1>\n<p>Edit me and press Run.</p>\n' },
  { id: 'markdown', label: 'Markdown notes', monaco: 'markdown', mode: 'none', hello: '# Notes\n\n- Agenda\n- Decisions\n- Next steps\n' },
];
export const langOf = (id: string) => LANGS.find((l) => l.id === id) ?? LANGS[0];
export interface RunResult { output: string; html?: string }

function runJs(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const src = 'const out=[];const f=(a)=>a.map((x)=>typeof x==="string"?x:JSON.stringify(x)).join(" ");' +
      'console.log=(...a)=>out.push(f(a));console.error=(...a)=>out.push("Error: "+f(a));console.warn=console.log;' +
      'self.onmessage=async()=>{try{await (async()=>{\n' + code + '\n})();}catch(e){out.push("Error: "+(e&&e.message||e))}postMessage(out.join("\\n"))}';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    const done = (output: string) => { clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); resolve({ output }); };
    const t = setTimeout(() => done('Stopped: the code ran for more than 5 seconds.'), 5000);
    w.onmessage = (e: MessageEvent<string>) => done(e.data || '(no output)');
    w.onerror = (e) => done('Error: ' + e.message);
    w.postMessage(0);
  });
}

let pyReady: Promise<any> | null = null;
function loadPython(): Promise<any> {
  if (!pyReady) {
    pyReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
      s.onload = () => (window as any).loadPyodide().then(resolve, reject);
      s.onerror = () => { pyReady = null; reject(new Error('Could not download the Python runtime. Check your internet connection.')); };
      document.head.append(s);
    });
  }
  return pyReady;
}
async function runPython(code: string): Promise<RunResult> {
  const py = await loadPython();
  const out: string[] = [];
  py.setStdout({ batched: (s: string) => out.push(s) });
  py.setStderr({ batched: (s: string) => out.push(s) });
  try { await py.runPythonAsync(code); } catch (e) { out.push(String(e instanceof Error ? e.message : e).split('\n').slice(-4).join('\n')); }
  return { output: out.join('\n') || '(no output)' };
}

/** JavaScript, Python and HTML run in the browser. Everything else goes through the API's code runner. */
export async function runCode(lang: Lang, code: string): Promise<RunResult> {
  switch (lang.mode) {
    case 'browser-js': return runJs(code);
    case 'browser-py': return runPython(code);
    case 'browser-html': return { output: '', html: code };
    case 'none': return { output: 'This format is for notes and cannot be run.' };
    default: {
      const r = await api<{ output: string }>('/run', { method: 'POST', body: { language: lang.id, code } });
      return { output: r.output || '(no output)' };
    }
  }
}
