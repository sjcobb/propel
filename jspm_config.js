System.config({
  baseURL: "/",
  transpiler: "typescript",
  packages: {
    "codemirror": { defaultExtension: "js", main: "lib/codemirror.js" },
    "typescript": { defaultExtension: "js", main: "lib/typescript.js" },
    "d3":         { defaultExtension: "js", main: "build/d3.js" },
    "seedrandom": { defaultExtension: "js", main: "seedrandom.js" },
    "/":          { defaultExtension: "ts" },
  },
  paths: {
    "*": "node_modules/*",
  },
});
