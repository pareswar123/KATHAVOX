import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  output,
  signal,
} from '@angular/core';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { StoriesApi } from '../../core/api/stories.api';
import { ApiError } from '../../core/http/error.interceptor';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

/**
 * Rich-text editor for story pages (Tiptap, MIT). Emits HTML on every change.
 * The backend sanitises the HTML again, so the editor is not trusted on its own.
 */
@Component({
  selector: 'kv-rich-text-editor',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-md border border-slate-300 dark:border-slate-700">
      <div class="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-700" role="toolbar">
        <button type="button" (click)="paragraph()" class="kv-btn">{{ 'editor.paragraph' | translate }}</button>
        <button type="button" (click)="heading(2)" class="kv-btn">{{ 'editor.heading2' | translate }}</button>
        <button type="button" (click)="heading(3)" class="kv-btn">{{ 'editor.heading3' | translate }}</button>
        <button type="button" (click)="bold()" class="kv-btn font-bold" [attr.aria-pressed]="isActive('bold')">B</button>
        <button type="button" (click)="italic()" class="kv-btn italic" [attr.aria-pressed]="isActive('italic')">I</button>
        <button type="button" (click)="underline()" class="kv-btn underline" [attr.aria-pressed]="isActive('underline')">U</button>
        <button type="button" (click)="bulletList()" class="kv-btn">{{ 'editor.bulletList' | translate }}</button>
        <button type="button" (click)="orderedList()" class="kv-btn">{{ 'editor.orderedList' | translate }}</button>
        <label class="kv-btn cursor-pointer">
          {{ (uploading() ? 'common.loading' : 'editor.image') | translate }}
          <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" (change)="onImage($event)" />
        </label>
      </div>
      <div #host class="kv-editor min-h-[240px] p-3 text-slate-900 dark:text-slate-100"></div>
      @if (error()) {
        <p role="alert" class="border-t border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {{ error() }}
        </p>
      }
    </div>
  `,
  styles: `
    .kv-btn {
      border-radius: 0.375rem;
      border: 1px solid rgb(203 213 225);
      padding: 0.25rem 0.5rem;
      font-size: 0.875rem;
      background: white;
      color: rgb(15 23 42);
    }
    .kv-btn[aria-pressed='true'] {
      background: rgb(79 70 229);
      color: white;
    }
    :host-context(.dark) .kv-btn {
      background: rgb(15 23 42);
      color: rgb(226 232 240);
      border-color: rgb(51 65 85);
    }
    .kv-editor :global(.ProseMirror) {
      outline: none;
      min-height: 220px;
    }
    .kv-editor :global(img) {
      max-width: 100%;
      height: auto;
    }
  `,
})
export class RichTextEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLElement>;

  private readonly api = inject(StoriesApi);
  private readonly platformId = inject(PLATFORM_ID);
  private editor: Editor | null = null;
  private initialHtml = '';

  /** Emitted with the full HTML after every change. */
  readonly contentChange = output<string>();

  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeMarks = signal(0);

  /** Sets the editor content. Ignored when the value already matches, so typing is not interrupted. */
  @Input({ required: false })
  set content(value: string) {
    this.initialHtml = value ?? '';
    if (this.editor && this.editor.getHTML() !== this.initialHtml) {
      this.editor.commands.setContent(this.initialHtml, { emitUpdate: false });
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.editor = new Editor({
      element: this.host.nativeElement,
      extensions: [StarterKit, Underline, Image.configure({ inline: false, allowBase64: false })],
      content: this.initialHtml,
      editorProps: { attributes: { 'aria-label': translate('editor.placeholder') } },
      onUpdate: ({ editor }) => this.contentChange.emit(editor.getHTML()),
      onSelectionUpdate: () => this.activeMarks.update((n) => n + 1),
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  isActive(mark: 'bold' | 'italic' | 'underline'): boolean {
    this.activeMarks();
    return this.editor?.isActive(mark) ?? false;
  }

  paragraph(): void {
    this.editor?.chain().focus().setParagraph().run();
  }

  heading(level: 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  bold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  italic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  underline(): void {
    this.editor?.chain().focus().toggleUnderline().run();
  }

  bulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  orderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  onImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.editor) return;

    this.uploading.set(true);
    this.error.set(null);
    this.api.uploadImage(file, 'image').subscribe({
      next: ({ url }) => {
        this.uploading.set(false);
        this.editor?.chain().focus().setImage({ src: url }).run();
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.error.set(err instanceof ApiError ? err.message : translate('errors.generic'));
      },
    });
  }
}
