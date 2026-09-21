import { PolicyResolver } from './src/orchestration/PolicyResolver';

const resolver = new PolicyResolver(require('path').resolve(__dirname, '../docs/active'));

// @ts-ignore
resolver.extractYamlBlocks = () => [
  `id: TEST-BOGUS\ntype: DECISION\nstatus: BOGUS\nscope:\n  - GLOBAL`,
];

try {
  resolver.resolve();
  console.log('FAIL: Bogus status parsed successfully');
} catch (e: any) {
  if (e.message.includes('Invalid governance record status')) {
    console.log('PASS: Bogus status rejected');
  } else {
    console.log('FAIL: Incorrect error message: ' + e.message);
  }
}

// @ts-ignore
resolver.extractYamlBlocks = () => [
  `id: TEST-TYPE\ntype: BOGUS\nstatus: ACTIVE\nscope:\n  - GLOBAL`,
];

try {
  resolver.resolve();
  console.log('FAIL: Bogus type parsed successfully');
} catch (e: any) {
  if (e.message.includes('Invalid governance record type')) {
    console.log('PASS: Bogus type rejected');
  } else {
    console.log('FAIL: Incorrect error message: ' + e.message);
  }
}
