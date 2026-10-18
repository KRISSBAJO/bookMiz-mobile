import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript");
const code = ts.transpileModule(
  readFileSync(
    new URL("../src/lib/booking-documents.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
function fixture(options = {}) {
  const deleted = [],
    uploads = [],
    downloads = [];
  let shared = false;
  class File {
    constructor(parent, name) {
      this.uri = name ? parent.uri + name : parent;
      this.exists = true;
      this.size = options.size ?? 8;
    }
    async base64() {
      return "fixture-content";
    }
    delete() {
      deleted.push(this.uri);
      this.exists = false;
    }
    static async downloadFileAsync(url, target, request) {
      downloads.push({ url, uri: target.uri, headers: request.headers });
      return target;
    }
  }
  const modules = {
    "expo-file-system": { File, Paths: { cache: { uri: "file:///cache/" } } },
    "expo-document-picker": {
      getDocumentAsync: async () =>
        options.cancelled
          ? { canceled: true }
          : {
              canceled: false,
              assets: [
                {
                  uri: options.uri ?? "file:///cache/chosen.png",
                  name: "chosen.png",
                  mimeType: "image/png",
                  size: options.size ?? 8,
                },
              ],
            },
    },
    "expo-sharing": {
      isAvailableAsync: async () => true,
      shareAsync: async () => {
        shared = true;
      },
    },
    "react-native": {
      Platform: { OS: "ios" },
      Linking: { openURL: async () => {} },
    },
    "@/src/lib/api/client": {
      getAuthTokens: () => ({ accessToken: "fixture-access-token" }),
    },
    "@/src/lib/api/bookings": {
      getCustomerBooking: async () => ({
        documentUploadToken: "fixture-upload-token",
      }),
      uploadBookingDocument: async (id, payload) => {
        uploads.push({ id, payload });
        if (options.failUpload) throw Error("upload failed");
      },
    },
    "@/src/lib/mobile-env": {
      mobileEnv: {
        bookingApiUrl: "https://booking.invalid/api",
        webAppUrl: "https://www.bookmiz.com",
      },
    },
  };
  const api = {};
  new Function("require", "exports", code)((name) => {
    if (modules[name]) return modules[name];
    throw Error(name);
  }, api);
  return { api, uploads, downloads, deleted, shared: () => shared };
}
test("upload uses a fresh customer-owned token and removes its temporary cache copy", async () => {
  const f = fixture();
  await f.api.addBookingDocument("booking");
  assert.equal(f.uploads[0].payload.uploadToken, "fixture-upload-token");
  assert.equal(f.uploads[0].payload.contentBase64, "fixture-content");
  assert.deepEqual(f.deleted, ["file:///cache/chosen.png"]);
});
test("cancelled selection sends nothing and oversized/failed uploads clean their cache files", async () => {
  const cancelled = fixture({ cancelled: true });
  await cancelled.api.addBookingDocument("booking");
  assert.equal(cancelled.uploads.length, 0);
  const large = fixture({ size: 11 * 1024 * 1024 });
  await assert.rejects(large.api.addBookingDocument("booking"), /10 MB/);
  assert.equal(large.uploads.length, 0);
  assert.equal(large.deleted.length, 1);
  const failed = fixture({ failUpload: true });
  await assert.rejects(
    failed.api.addBookingDocument("booking"),
    /upload failed/,
  );
  assert.equal(failed.deleted.length, 1);
});
test("document downloads authenticate, sanitize cache paths, share and remove temporary files", async () => {
  const f = fixture();
  await f.api.openBookingDocument("booking", {
    id: "fixture",
    fileName: "../../private.pdf",
    mimeType: "application/pdf",
  });
  assert.equal(
    f.downloads[0].headers.Authorization,
    "Bearer fixture-access-token",
  );
  assert.ok(!f.downloads[0].uri.includes("../"));
  assert.equal(f.shared(), true);
  assert.equal(f.deleted.length, 1);
});
