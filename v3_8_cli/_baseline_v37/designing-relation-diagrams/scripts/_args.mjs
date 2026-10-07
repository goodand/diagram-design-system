// Shared CLI argument parsing for the bundled scripts.
export function parseArgs(argv) {
  const out = { pos: [], level: 2, expand: [], collapse: [], focus: null, pad: 24 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--level') out.level = Number(argv[++i]);
    else if (a === '--expand') out.expand = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--collapse') out.collapse = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--focus') out.focus = argv[++i];
    else if (a === '--pad') out.pad = Number(argv[++i]);
    else out.pos.push(a);
  }
  return out;
}
