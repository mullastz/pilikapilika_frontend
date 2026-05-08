import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
  badge?: (value: any, row: any) => { text: string; class: string } | null;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css'
})
export class DataTable {
  @Input() columns: TableColumn[] = [];
  @Input() rows: any[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No data found.';
  @Input() actions = true;

  @Output() view = new EventEmitter<any>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();

  getCellValue(col: TableColumn, row: any): string {
    const value = this.getNestedValue(row, col.key);
    if (col.format) {
      return col.format(value, row);
    }
    return value !== null && value !== undefined ? String(value) : '-';
  }

  getBadge(col: TableColumn, row: any) {
    if (!col.badge) return null;
    const value = this.getNestedValue(row, col.key);
    return col.badge(value, row);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }
}
