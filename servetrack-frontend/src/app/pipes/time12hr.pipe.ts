import { Pipe, PipeTransform } from '@angular/core';

/**
 * Converts 24-hour time strings to 12-hour format with AM/PM.
 *
 * Handles:
 * - Single times: "06:30" → "6:30 AM", "14:00" → "2:00 PM"
 * - Time ranges: "06:30 - 10:30" → "6:30 AM - 10:30 AM"
 * - Already 12hr format: "6:30 AM" → "6:30 AM" (passthrough)
 * - Null/empty: returns empty string
 *
 * Usage: {{ timeValue | time12hr }}
 */
@Pipe({
  name: 'time12hr',
})
export class Time12hrPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    // Handle time ranges (e.g. "06:30 - 10:30")
    if (value.includes(' - ')) {
      const [start, end] = value.split(' - ');
      return `${this.convertTo12Hour(start.trim())} - ${this.convertTo12Hour(end.trim())}`;
    }

    return this.convertTo12Hour(value.trim());
  }

  private convertTo12Hour(time24: string): string {
    if (!time24) return '';

    // Already in 12hr format
    if (time24.includes('AM') || time24.includes('PM')) return time24;

    // Not a time string
    if (!time24.includes(':')) return time24;

    const [hourPart, minutePart] = time24.split(':');
    const hour = Number.parseInt(hourPart, 10);

    if (Number.isNaN(hour)) return time24;

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutePart} ${period}`;
  }
}
