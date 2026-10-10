declare module '@wllama/wllama/esm/wasm/wllama.wasm?url' {
  const url: string;
  export default url;
}
declare module '@wllama/wllama-compat/wasm/wllama.wasm?url' {
  const url: string;
  export default url;
}
declare module '@wllama/wllama-compat/wasm/wllama.js?raw' {
  const code: string;
  export default code;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}
declare module '*.js?raw' {
  const code: string;
  export default code;
}
