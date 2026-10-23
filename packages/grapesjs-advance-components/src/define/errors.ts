/** Thrown for a mistake in a component spec, with a message that says what to change. */
export class DefineComponentError extends Error {
  constructor(id: string, message: string) {
    super(`defineComponent("${id}"): ${message}`);
    this.name = 'DefineComponentError';
  }
}
