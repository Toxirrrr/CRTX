import { CapabilityMatch } from "../../sdk/src/contracts";
import { SelectionPolicy } from "../../sdk/src/command";

export class FirstMatchPolicy implements SelectionPolicy {
  select(matches: CapabilityMatch[]): CapabilityMatch | null {
    if (!matches || matches.length === 0) {
      return null;
    }
    return matches[0];
  }
}
