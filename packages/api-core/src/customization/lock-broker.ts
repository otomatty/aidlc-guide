/** Bundled, fixed Bun program. Only the checked lock filename is passed as an argument. */
export const CUSTOMIZATION_LOCK_BROKER = String.raw`
import { dlopen, FFIType } from "bun:ffi";
import { closeSync, openSync } from "node:fs";
const file = process.argv[1];
let closed = false;
let release = () => {};
const input = new Promise(resolve => {
  process.stdin.once("end", () => { closed = true; resolve(); });
  process.stdin.once("error", () => { closed = true; resolve(); });
  process.stdin.resume();
});
try {
  let acquire;
  if (process.platform === "win32") {
    const api = dlopen("kernel32.dll", {
      CreateFileW: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr], returns: FFIType.ptr },
      LockFileEx: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.ptr], returns: FFIType.bool },
      UnlockFileEx: { args: [FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.ptr], returns: FFIType.bool },
      CloseHandle: { args: [FFIType.ptr], returns: FFIType.bool },
    });
    const wide = Buffer.from(file + "\0", "utf16le");
    const handle = api.symbols.CreateFileW(wide, 0xc0000000, 3, null, 4, 0x80, null);
    if (handle === null || BigInt.asIntN(64, BigInt(handle)) === -1n) throw new Error("lock-open-failed");
    const overlapped = new Uint8Array(32);
    acquire = () => api.symbols.LockFileEx(handle, 3, 0, 1, 0, overlapped);
    release = () => { api.symbols.UnlockFileEx(handle, 0, 1, 0, overlapped); api.symbols.CloseHandle(handle); api.close(); };
  } else {
    const arch = ({ x64: "x86_64", arm64: "aarch64", ia32: "i386", ppc64: "powerpc64le" })[process.arch] ?? process.arch;
    const candidates = process.platform === "darwin" ? ["/usr/lib/libSystem.B.dylib"] : ["libc.so.6", "/lib/ld-musl-" + arch + ".so.1", "/usr/lib/ld-musl-" + arch + ".so.1", "/lib/libc.musl-" + arch + ".so.1", "libc.so"];
    let api;
    const errors = [];
    for (const library of candidates) {
      try { api = dlopen(library, { flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } }); break; } catch (error) { errors.push(library + ": " + error.message); }
    }
    if (!api) throw new Error("lock-runtime-unavailable: " + errors.join("; "));
    const fd = openSync(file, "a+", 0o600);
    acquire = () => api.symbols.flock(fd, 2 | 4) === 0;
    release = () => { api.symbols.flock(fd, 8); closeSync(fd); api.close(); };
  }
  const deadline = Date.now() + 125000;
  while (!closed && !acquire()) {
    if (Date.now() > deadline) throw new Error("lock-timeout");
    await Bun.sleep(20);
  }
  if (!closed) { process.stdout.write("locked\n"); await input; }
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : "lock-failed");
  process.exitCode = 1;
} finally { release(); }
`;
