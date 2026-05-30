import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
  AfterViewInit,
} from '@angular/core';
import { ChatVisualization } from '../../../models/chatbot.model';

/**
 * Lightweight chart component for rendering inline visualizations in chat.
 * Uses Canvas API directly — no external charting library required.
 * Supports: doughnut, pie, bar, line.
 */
@Component({
  selector: 'app-chat-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-chart.component.html',
  styleUrl: './chat-chart.component.scss',
})
export class ChatChartComponent implements OnChanges, AfterViewInit {
  @Input() visualization!: ChatVisualization;

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private readonly defaultColors = [
    '#2563eb', '#dc2626', '#16a34a', '#f59e0b',
    '#9333ea', '#0891b2', '#ea580c', '#334155',
    '#059669', '#be123c', '#65a30d', '#d97706',
  ];

  private rendered = false;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visualization'] && this.visualization && this.canvasRef()) {
      this.renderChart();
    }
  }

  private renderChart(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.visualization || this.rendered) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.rendered = true;
    const { type, data, colors } = this.visualization;
    const palette = colors || this.generateColors(data.labels.length);

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    switch (type) {
      case 'doughnut':
      case 'pie':
        this.drawPieChart(ctx, data, palette, width, height, type === 'doughnut');
        break;
      case 'bar':
        this.drawBarChart(ctx, data, palette, width, height);
        break;
      case 'line':
        this.drawLineChart(ctx, data, palette, width, height);
        break;
    }

    // Draw legend
    this.drawLegend(ctx, data.labels, palette, width, height);
  }

  private drawPieChart(
    ctx: CanvasRenderingContext2D,
    data: { labels: string[]; values: number[] },
    colors: string[],
    width: number,
    height: number,
    isDoughnut: boolean,
  ): void {
    const total = data.values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return;

    const cx = width / 2;
    const cy = (height - 30) / 2; // Leave room for legend
    const radius = Math.min(cx, cy) - 10;
    let startAngle = -Math.PI / 2;

    for (let i = 0; i < data.values.length; i++) {
      const sliceAngle = (data.values[i] / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      startAngle += sliceAngle;
    }

    if (isDoughnut) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  private drawBarChart(
    ctx: CanvasRenderingContext2D,
    data: { labels: string[]; values: number[] },
    colors: string[],
    width: number,
    height: number,
  ): void {
    const chartHeight = height - 50; // Legend space
    const chartWidth = width - 40;
    const maxVal = Math.max(...data.values, 1);
    const barCount = data.values.length;
    const barWidth = Math.min(30, (chartWidth - barCount * 4) / barCount);
    const startX = (width - (barWidth + 4) * barCount) / 2;

    for (let i = 0; i < barCount; i++) {
      const barHeight = (data.values[i] / maxVal) * (chartHeight - 20);
      const x = startX + i * (barWidth + 4);
      const y = chartHeight - barHeight;

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 3);
      ctx.fill();

      // Value label
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.values[i].toString(), x + barWidth / 2, y - 4);
    }
  }

  private drawLineChart(
    ctx: CanvasRenderingContext2D,
    data: { labels: string[]; values: number[] },
    colors: string[],
    width: number,
    height: number,
  ): void {
    const chartHeight = height - 50;
    const chartWidth = width - 40;
    const maxVal = Math.max(...data.values, 1);
    const pointCount = data.values.length;
    const stepX = chartWidth / Math.max(pointCount - 1, 1);
    const startX = 20;

    // Draw fill
    ctx.beginPath();
    ctx.moveTo(startX, chartHeight);
    for (let i = 0; i < pointCount; i++) {
      const x = startX + i * stepX;
      const y = chartHeight - (data.values[i] / maxVal) * (chartHeight - 20);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(startX + (pointCount - 1) * stepX, chartHeight);
    ctx.closePath();
    ctx.fillStyle = this.hexToRgba(colors[0], 0.15);
    ctx.fill();

    // Draw line
    ctx.beginPath();
    for (let i = 0; i < pointCount; i++) {
      const x = startX + i * stepX;
      const y = chartHeight - (data.values[i] / maxVal) * (chartHeight - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dots
    for (let i = 0; i < pointCount; i++) {
      const x = startX + i * stepX;
      const y = chartHeight - (data.values[i] / maxVal) * (chartHeight - 20);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = colors[0];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private drawLegend(
    ctx: CanvasRenderingContext2D,
    labels: string[],
    colors: string[],
    width: number,
    height: number,
  ): void {
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';

    let x = 10;
    const y = height - 10;

    for (let i = 0; i < Math.min(labels.length, 6); i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y - 8, 10, 10);

      ctx.fillStyle = '#6b7280';
      const text = labels[i].length > 12 ? labels[i].slice(0, 11) + '…' : labels[i];
      ctx.fillText(text, x + 14, y);
      x += ctx.measureText(text).width + 24;

      if (x > width - 40) break; // Overflow protection
    }
  }

  private generateColors(count: number): string[] {
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      colors.push(this.defaultColors[i % this.defaultColors.length]);
    }
    return colors;
  }

  private hexToRgba(hex: string, alpha: number): string {
    if (hex.startsWith('rgb')) return hex;
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
