import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [ RouterLink ],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  isDark = false;

  ngOnInit() {
    const saved = localStorage.getItem('theme');
    this.isDark = saved === 'dark';
  }

  toggleTheme() {
    this.isDark = !this.isDark;

    localStorage.setItem('theme', this.isDark ? 'dark' : 'light');

    this.applyTheme();
  }

  private applyTheme() {
    const html = document.documentElement;

    if (this.isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }
}
