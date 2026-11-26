import messages from './en.json';

type Messages = typeof messages;
type Leaf<T, P extends string = ''> = T extends string
  ? P
  : { [K in keyof T & string]: Leaf<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string];

/** Every valid message key, e.g. "auth.invalidCredentials". Typos fail at compile time. */
export type MessageKey = Leaf<Messages>;

/** Looks up a message in en.json and fills {{placeholders}}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages);
  if (typeof template !== 'string') throw new Error(`Missing message key: ${key}`);
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ''));
}
