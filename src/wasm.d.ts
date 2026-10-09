/** Bun file imports (`with { type: "file" }`) resolve to the file path. */
declare module "*.wasm" {
  const path: string;
  export default path;
}
