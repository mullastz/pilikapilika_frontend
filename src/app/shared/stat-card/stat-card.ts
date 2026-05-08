import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css'
})
export class StatCard {
  @Input() icon = 'fa-solid fa-chart-line';
  @Input() label = 'Stat';
  @Input() value: string | number = '0';
  @Input() color = 'bg-orange-500';
  @Input() trend?: number;
}
