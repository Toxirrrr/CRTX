import { PolicyResolver } from './src/orchestration/PolicyResolver';
try {
  console.log('Resolving...');
  const resolver = new PolicyResolver(require('path').resolve(__dirname, '../docs/active'));
  const records = resolver.resolve();
  console.log('Records length:', records.length);
} catch (e: any) {
  console.log('Caught error:', e.message);
}
