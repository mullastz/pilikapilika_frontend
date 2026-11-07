import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { Header } from '../../shared/header/header';
import { Footer } from '../../shared/footer/footer';
import { PageHero } from '../../shared/components/page-hero/page-hero';
import { BlogPost, BlogService } from '../../core/services/blog.service';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-blog',
  imports: [RouterLink, Header, Footer, PageHero],
  templateUrl: './blog.html',
})
export class Blog implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly blog = inject(BlogService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(true);
  readonly slug = signal<string | null>(null);
  readonly posts = signal<BlogPost[]>([]);
  readonly selectedPost = signal<BlogPost | null>(null);
  readonly guides = [
    { title: 'China to Tanzania Cargo & Shipping Guide', excerpt: 'Compare air and sea freight, prepare your cargo details, and plan your shipment with an agent.', path: '/china-to-tanzania-cargo', icon: 'fa-ship' },
    { title: 'How Pilikapilika Works', excerpt: 'Find an agent, book a shipment, follow parcel updates, and confirm your delivery.', path: '/how-it-works', icon: 'fa-box-open' },
  ];

  ngOnInit(): void {
    this.route.paramMap.pipe(
      tap(params => { this.slug.set(params.get('slug')); this.selectedPost.set(null); this.loading.set(true); }),
      switchMap(() => this.blog.getPosts()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(posts => {
      this.posts.set(posts);
      const post = posts.find(item => item.slug === this.slug()) ?? null;
      this.selectedPost.set(post);
      this.loading.set(false);
      if (this.slug()) {
        this.seo.update({ title: post ? `${post.title} | Pilikapilika Blog` : 'Article not found | Pilikapilika', description: post?.excerpt || 'Explore shipping guides and articles on the Pilikapilika blog.', path: post ? `/blog/${post.slug}` : undefined, index: !!post });
      }
    });
  }
}
