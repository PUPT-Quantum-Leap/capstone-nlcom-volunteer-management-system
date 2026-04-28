import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TitleCasePipe],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
})
export class RequestsComponent {
  // ── Request Tabs ────────────────────────────────────────────────────────
  requestTab = signal<'change-task' | 'close-poll'>('change-task');

  // ── Change Task State ────────────────────────────────────────────────────
  selectedTask = signal<string>('');
  changeTaskReason = signal<string>('');
  changeTaskStatus = signal<'pending' | 'approved' | 'rejected'>('pending');
  changeTaskResponseReason = signal<string>('');

  // ── Close Poll State ────────────────────────────────────────────────────
  closePollAction = signal<'change-time' | 'not-attending'>('change-time');
  closePollNewTime = signal<string>('');
  closePollReason = signal<string>('');
  closePollStatus = signal<'pending' | 'approved' | 'rejected'>('pending');
  closePollResponseReason = signal<string>('');

  isLoading = signal(false);

  availableTasks = signal<string[]>([
    'Ushering & Welcome Team',
    'Media Team (Sound / Lights)',
    'Photography / Videography',
    'Social Media / Marketing',
    'Prayer Ministry',
    'Admin / Registration',
    'Ushering',
    'Kids Ministry',
    'Worship Team',
    'Technical Team',
    'Community Outreach',
    'Facility Setup',
    'Hospitality / Food Service',
    'Transportation',
    'Translation / Interpretation',
    'Other',
  ]);

  setRequestTab(tab: 'change-task' | 'close-poll'): void {
    this.requestTab.set(tab);
  }

  submitChangeTaskRequest(): void {
    if (!this.selectedTask() || !this.changeTaskReason()) return;

    this.isLoading.set(true);
    setTimeout(() => {
      this.changeTaskStatus.set('pending');
      this.isLoading.set(false);
      this.selectedTask.set('');
      this.changeTaskReason.set('');
    }, 1000);
  }

  submitClosePollRequest(): void {
    if (!this.closePollReason()) return;
    if (this.closePollAction() === 'change-time' && !this.closePollNewTime()) return;

    this.isLoading.set(true);
    setTimeout(() => {
      this.closePollStatus.set('pending');
      this.isLoading.set(false);
      this.closePollNewTime.set('');
      this.closePollReason.set('');
    }, 1000);
  }

  resetChangeTaskForm(): void {
    this.selectedTask.set('');
    this.changeTaskReason.set('');
    this.changeTaskStatus.set('pending');
    this.changeTaskResponseReason.set('');
  }

  resetClosePollForm(): void {
    this.closePollAction.set('change-time');
    this.closePollNewTime.set('');
    this.closePollReason.set('');
    this.closePollStatus.set('pending');
    this.closePollResponseReason.set('');
  }

  // ── Input Handlers ───────────────────────────────────────────────────────
  onTaskSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedTask.set(select.value);
  }

  onTaskReasonInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.changeTaskReason.set(textarea.value);
  }

  onClosePollNewTimeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.closePollNewTime.set(input.value);
  }

  onClosePollReasonInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.closePollReason.set(textarea.value);
  }
}
