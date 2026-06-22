#!/usr/bin/env node
/**
 * Compatibility shim. The canonical installer now installs all Farplane hooks.
 */
const { main } = await import("./install-farplane-hooks.mjs");
main();
