import { Component, signal, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ToastComponent } from './shared/components/toast/toast.component';
import { MenuBar } from './shared/menu-bar/menu-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, MenuBar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('PilikaPilika_Frontend');
  showMenuBar = signal(true);
  private router = inject(Router);

  ngOnInit() {
    const saved = localStorage.getItem('theme');

    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    this.showMenuBar.set(!this.router.url.startsWith('/admin'));
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.showMenuBar.set(!e.url.startsWith('/admin'));
    });
  }
}
