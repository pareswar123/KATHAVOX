import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n';

const CLASSES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  ARCHIVED: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

@Component({
  selector: 'kv-status-badge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" [class]="classes()">
      {{ ('status.' + status()) | translate }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  classes(): string {
    return CLASSES[this.status()] ?? CLASSES['DRAFT'];
  }
}
