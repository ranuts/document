import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
const exec = promisify(execFile);
const protocol = JSON.parse(await fs.readFile('docs/evaluations/2026-10-07-cpu-memory-capacity-build-protocol.json'));
const source = protocol.sourceDirectory;
const run = async (cmd, args) => {
  const result = await exec(cmd, args, { maxBuffer: 32 * 1024 * 1024 });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
};
for (const [directory, expected] of [
  [source, protocol.sdkRevision],
  [source + '/llama.cpp', protocol.llamaRevision],
]) {
  const { stdout } = await exec('git', ['-C', directory, 'rev-parse', 'HEAD']);
  if (stdout.trim() !== expected) throw Error('Pinned source revision mismatch');
}
const cmakeFile = source + '/CMakeLists.txt';
const original = await fs.readFile(cmakeFile, 'utf8');
if (!original.includes('-sMAXIMUM_MEMORY=4096MB')) throw Error('Unexpected source memory flag');
await fs.writeFile(cmakeFile, original.replace('-sMAXIMUM_MEMORY=4096MB', '-sMAXIMUM_MEMORY=${WLLAMA_MEMORY_LIMIT}'));
await fs.mkdir(protocol.outputDirectory, { recursive: true });
for (const variant of protocol.variants) {
  await run('emcmake', [
    'cmake',
    '-S',
    source,
    '-B',
    protocol.buildDirectory,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DWLLAMA_COMPAT=OFF',
    '-DWLLAMA_MEMORY_LIMIT=' + variant.maximumMemory,
    '-DGGML_NATIVE=OFF',
    '-DGGML_OPENMP=OFF',
    '-DGGML_BLAS=OFF',
    '-DLLAMA_BUILD_TESTS=OFF',
    '-DLLAMA_BUILD_EXAMPLES=OFF',
    '-DLLAMA_BUILD_SERVER=OFF',
  ]);
  await run('cmake', ['--build', protocol.buildDirectory, '--target', 'wllama', '-j', '4']);
  for (const suffix of ['js', 'wasm'])
    await fs.copyFile(
      protocol.buildDirectory + '/wllama.' + suffix,
      protocol.outputDirectory + '/' + variant.label + '.' + suffix,
    );
}
