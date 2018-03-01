import * as fs from "fs";
import { JSDOM } from "jsdom";
import { join } from "path";
import { renderSync } from "sass";
import { URL } from "url";
import { delay } from "../src/util";
import { drainExecuteQueue } from "../website/notebook";
import * as website from "../website/website";
import * as gendoc from "./gendoc";
import * as run from "./run";

// tslint:disable:no-reference
/// <reference path="deps/firebase/firebase.d.ts" />

const websiteRoot = run.root + "/build/website/";

async function fetch(url, options) {
  const path = new URL(url);
  console.log(path);
  const data = fs.readFileSync(path);
  return {
    async arrayBuffer() { return data; },
    async text() { return data.toString("utf8"); }
  };
}

async function renderToHtmlWithJsdom(page: website.Page): Promise<string> {
  const jsdom =
    new JSDOM("", {
      beforeParse(window: any) {
        window.fetch = fetch;
      },
      resources: "usable",
      runScripts: "dangerously"
    });
  const window = jsdom.window;

  global["window"] = window;
  global["self"] = window;
  global["document"] = window.document;
  global["navigator"] = window.navigator;
  global["Node"] = window.Node;
  global["getComputedStyle"] = window.getComputedStyle;

  website.renderPage(page);

  const p = new Promise<string>((resolve, reject) => {
    window.addEventListener("load", async() => {
      try {
        await drainExecuteQueue();
        await delay(5000);
        console.log('drained');
        const bodyHtml = document.body.innerHTML;
        const html =  website.getHTML(page.title, bodyHtml);
        resolve(html);
      } catch (e) {
        reject(e);
      }
    });
  });
  return p;
}

async function writePages() {
  for (const page of website.pages) {
    console.log(page);
    const html = await renderToHtmlWithJsdom(page);
    const fn = join(run.root, "build", page.path);
    fs.writeFileSync(fn, html);
    console.log("Wrote", fn);
  }
}

function scss(inFile, outFile) {
  const options = {
    file: inFile,
    includePaths: ["./website"],
  };
  const result = renderSync(options).css.toString("utf8");
  console.log("scss", inFile, outFile);
  fs.writeFileSync(outFile, result);
}

process.on("unhandledRejection", e => { throw e; });

(async() => {
  /*
  run.mkdir("build");
  run.mkdir("build/website");
  run.mkdir("build/website/docs");
  run.mkdir("build/website/notebook");

  run.symlink(run.root + "/website/", "build/website/static");
  run.symlink(run.root + "/deps/data/", "build/website/data");

  gendoc.writeJSON("build/website/docs.json");

  scss("website/main.scss", join(websiteRoot, "bundle.css"));
  */
  await run.parcel("website/website_main.ts", "build/website");
  await run.parcel("website/nb_sandbox.ts", "build/website");
  console.log("Website built in", websiteRoot);

  await writePages();

  // Firebase keeps network connections open, so we have force exit the process.
  process.exit(0);
})();
