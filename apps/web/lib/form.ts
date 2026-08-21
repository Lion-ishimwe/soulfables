/**
 * FormData helpers.
 *
 * `formData.get()` returns `string | File | null`. Zod's `.optional()`
 * accepts `undefined`, not `null`, so reading an absent field straight
 * into an optional schema fails validation with "Expected string,
 * received null" — which is both wrong and unhelpful, because the field
 * being absent is exactly what optional was supposed to allow.
 *
 * That bug shipped once already: sign-in rejected every submission that
 * had no `next` parameter, which is most of them. These helpers exist so
 * it cannot happen again field by field.
 */

/** A text field, or undefined when absent. Never null, never a File. */
export function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === 'string' ? value : undefined;
}

/** A checkbox: true only when the browser actually sent it. */
export function checkbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true' || value === '1';
}

/** A file input, or undefined when nothing was chosen. */
export function file(formData: FormData, name: string): File | undefined {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : undefined;
}
