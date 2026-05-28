import { Component, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartOptions, ChartType } from 'chart.js';
import { ChatVisualization } from '../../../../models/chatbot.model';

Chart.register(...registerables);

@Component({
  selector: 'app-chat-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './chat-chart.component.html',
  styleUrl: './chat-chart.component.scss'
})
export class ChatChartComponent implements OnInit {
  visualization = input.required<ChatVisualization>();

  chartData: any;
  chartType: ChartType = 'bar';
  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#4b5563',
          font: { family: 'Inter, sans-serif' }
        }
      }
    }
  };

  private brandColors = ['#13518c', '#3577b6', '#fbb03b', '#2ecc71', '#e74c3c'];

  ngOnInit() {
    const viz = this.visualization();
    this.chartType = viz.type as ChartType;
    
    const datasets = viz.data.datasets.map((ds, i) => {
      const isPieOrDoughnut = viz.type === 'pie' || viz.type === 'doughnut';
      return {
        ...ds,
        backgroundColor: ds.backgroundColor || (isPieOrDoughnut ? this.brandColors : this.brandColors[i % this.brandColors.length]),
        borderColor: ds.borderColor || (isPieOrDoughnut ? '#ffffff' : this.brandColors[i % this.brandColors.length]),
        borderWidth: 1
      };
    });

    this.chartData = {
      labels: viz.data.labels,
      datasets: datasets
    };
    
    if (viz.options) {
      this.chartOptions = { ...this.chartOptions, ...viz.options };
    }
  }
}
