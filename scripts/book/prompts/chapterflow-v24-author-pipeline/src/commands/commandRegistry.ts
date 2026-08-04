import type { CommandSpec } from "./commandSpec.js";

export class CommandRegistry {
  readonly #specs = new Map<string, CommandSpec>();

  register(spec: CommandSpec): void {
    if (!spec.id || this.#specs.has(spec.id)) throw new Error(`duplicate command spec: ${spec.id}`);
    this.#specs.set(spec.id, spec);
  }

  resolve(id: string): CommandSpec | undefined {
    return this.#specs.get(id);
  }
}
