import * as fs from 'fs';
import * as path from 'path';

export function runLock(args: string[]) {
  if (args.length < 2) {
    console.error('Usage: crtx lock <resource_name> <agent_id>');
    process.exit(1);
  }

  const resource = args[0];
  const agentId = args[1];
  const locksDir = path.resolve(process.cwd(), 'crtx/locks');

  if (!fs.existsSync(locksDir)) {
    fs.mkdirSync(locksDir, { recursive: true });
  }

  const lockPath = path.join(locksDir, resource + '.lock');

  if (fs.existsSync(lockPath)) {
    const currentOwner = fs.readFileSync(lockPath, 'utf-8').trim();
    if (currentOwner === agentId) {
      console.log('Lock on ' + resource + ' is already held by you (' + agentId + ').');
      process.exit(0);
    } else {
      console.error('ERROR: Lock on ' + resource + ' is held by another agent: ' + currentOwner);
      process.exit(1);
    }
  }

  fs.writeFileSync(lockPath, agentId);
  console.log('SUCCESS: Lock acquired on ' + resource + ' by ' + agentId + '.');
}

export function runUnlock(args: string[]) {
  if (args.length < 2) {
    console.error('Usage: crtx unlock <resource_name> <agent_id>');
    process.exit(1);
  }

  const resource = args[0];
  const agentId = args[1];
  const lockPath = path.resolve(process.cwd(), 'crtx/locks', resource + '.lock');

  if (!fs.existsSync(lockPath)) {
    console.log('Lock on ' + resource + ' does not exist.');
    process.exit(0);
  }

  const currentOwner = fs.readFileSync(lockPath, 'utf-8').trim();
  if (currentOwner !== agentId && agentId !== 'FORCE') {
    console.error('ERROR: Cannot unlock ' + resource + '. Owned by ' + currentOwner + ', not ' + agentId + '. (Use FORCE to override)');
    process.exit(1);
  }

  fs.unlinkSync(lockPath);
  console.log('SUCCESS: Lock released on ' + resource + '.');
}
