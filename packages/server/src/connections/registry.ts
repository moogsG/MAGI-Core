import type { ConnectionHelper, HelperContext } from "./types.js";

export class HelperRegistry {
  private helpers: Map<string, ConnectionHelper> = new Map();

  register(helper: ConnectionHelper) {
    if (this.helpers.has(helper.name)) {
      throw new Error(`Helper already registered: ${helper.name}`);
    }
    this.helpers.set(helper.name, helper);
  }

  list() { 
    return Array.from(this.helpers.values()); 
  }

  async initAll(ctxFactory: (name: string) => HelperContext) {
    for (const h of this.helpers.values()) {
      h.init(ctxFactory(h.name));
      if (h.start) await h.start();
    }
  }
}
