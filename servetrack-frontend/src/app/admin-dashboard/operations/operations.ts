import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-operations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="module-container"></section>`,
})
export class OperationsComponent {}

