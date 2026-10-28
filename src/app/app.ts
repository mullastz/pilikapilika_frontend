import { Component, signal, inject, afterNextRender } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ToastComponent } from './shared/components/toast/toast.component';
import { MenuBar } from './shared/menu-bar/menu-bar';
import { MenuBarService } from './core/services/menu-bar.service';
import { SeoService } from './core/services/seo.service';

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
  private menuBarService = inject(MenuBarService);

  constructor() {
    inject(SeoService).start();
    afterNextRender(() => {
      const saved = localStorage.getItem('theme');
      document.documentElement.classList.toggle('dark', saved === 'dark');
    });
  }

  ngOnInit() {
    this.showMenuBar.set(!this.router.url.startsWith('/admin'));
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.showMenuBar.set(!e.url.startsWith('/admin'));
      // Reset menu-bar visibility on every route change — prevents stale modal state
      this.menuBarService.reset();
    });
  }
}
