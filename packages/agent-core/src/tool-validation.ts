import { Validator, type Schema } from '@cfworker/json-schema';
import type { AgentTool } from './types';

const validators = new WeakMap<object, Validator>();
/** Validate untrusted model arguments with standard JSON Schema, without coercion or eval. */
export function validateToolInput(tool: AgentTool, input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Tool arguments must be an object';
  let validator = validators.get(tool.inputSchema);
  if (!validator) {
    validator = new Validator(structuredClone(tool.inputSchema) as Schema, '2020-12');
    validators.set(tool.inputSchema, validator);
  }
  const result = validator.validate(input);
  return result.valid
    ? undefined
    : result.errors
        .map((error) => `${error.instanceLocation}: ${error.error}`)
        .join('; ')
        .slice(0, 1000);
}
