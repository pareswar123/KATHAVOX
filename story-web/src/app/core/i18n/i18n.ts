import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';
import en from './en.json';

type Params = Record<string, string | number>;

/**
 * Looks up a label in en.json by dotted key and fills {{placeholders}}.
 * {{brand}} is always available from environment.brandName.
 * A missing key is shown as the key itself, so gaps are visible during development.
 */
export function translate(key: string, params: Params = {}): string {
  const template = key.split('.').reduce<unknown>(
    (node, part) => (node as Record<string, unknown> | undefined)?.[part],
    en,
  );
  if (typeof template !== 'string') return key;

  const values: Params = { brand: environment.brandName, ...params };
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values[name] ?? ''));
}

@Pipe({ name: 'translate', pure: true })
export class TranslatePipe implements PipeTransform {
  transform(key: string, params?: Params): string {
    return translate(key, params);
  }
}
