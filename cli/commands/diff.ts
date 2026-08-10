import { DiffParser } from '../../core/diff-parser';

export function runDiff() {
  const parser = new DiffParser();
  const files = parser.getModifiedFiles();
  
  if (files.length === 0) {
    console.log('No modified files detected.');
  } else {
    console.log('Modified files:');
    files.forEach(f => console.log(`- ${f}`));
  }
}
