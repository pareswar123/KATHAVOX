import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

interface ConfirmRequest {
  message: string;
  resolve: (answer: boolean) => void;
}

/** Opens the shared confirmation dialog and resolves with the user's answer. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  ask(messageKey: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.request.set({ message: translate(messageKey), resolve });
    });
  }

  answer(value: boolean): void {
    const current = this.request();
    this.request.set(null);
    current?.resolve(value);
  }
}

@Component({
  selector: 'kv-confirm-dialog',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.request(); as req) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
        <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900">
          <p class="text-slate-900 dark:text-slate-100">{{ req.message }}</p>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" (click)="confirm.answer(false)" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
              {{ 'common.cancel' | translate }}
            </button>
            <button type="button" (click)="confirm.answer(true)" class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              {{ 'common.confirm' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
}
