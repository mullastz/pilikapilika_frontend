import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ContentService } from './content.service';

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  published: boolean;
}

export function parseBlogPosts(value?: string): BlogPost[] {
  try {
    const posts: unknown = JSON.parse(value || '[]');
    if (!Array.isArray(posts)) return [];
    return posts.filter((post): post is BlogPost => post !== null && typeof post === 'object'
      && typeof post.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
      && typeof post.title === 'string' && typeof post.excerpt === 'string'
      && typeof post.body === 'string' && typeof post.published === 'boolean');
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly content = inject(ContentService);
  getPosts() {
    return this.content.getContent().pipe(map(content => parseBlogPosts(content['blog_posts']).filter(post => post.published)));
  }
}
