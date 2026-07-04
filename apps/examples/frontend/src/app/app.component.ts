import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../environments/environment';
import { Item } from './models/item.model';
import { AppVersion } from './models/version.model';
import { ItemsService } from './services/items.service';
import { VersionService } from './services/version.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly itemsService = inject(ItemsService);
  private readonly versionService = inject(VersionService);

  items = signal<Item[]>([]);
  backendVersion = signal<AppVersion | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  frontendVersion = environment.appVersion;
  frontendBuildSha = environment.buildSha;
  frontendBuildTime = environment.buildTime;

  title = '';
  description = '';
  editingId: string | null = null;

  ngOnInit(): void {
    this.loadVersion();
    this.loadItems();
  }

  loadVersion(): void {
    this.versionService.get().subscribe({
      next: (version) => this.backendVersion.set(version),
      error: () => this.backendVersion.set(null),
    });
  }

  shortSha(value: string): string {
    return value === 'local' ? value : value.slice(0, 7);
  }

  loadItems(): void {
    this.loading.set(true);
    this.error.set(null);

    this.itemsService.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load items. Is the backend running?');
        this.loading.set(false);
      },
    });
  }

  startEdit(item: Item): void {
    this.editingId = item.id;
    this.title = item.title;
    this.description = item.description;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.title = '';
    this.description = '';
  }

  submit(): void {
    if (!this.title.trim()) {
      return;
    }

    const payload = {
      title: this.title.trim(),
      description: this.description.trim(),
    };

    const request$ = this.editingId
      ? this.itemsService.update(this.editingId, payload)
      : this.itemsService.create(payload);

    request$.subscribe({
      next: () => {
        this.cancelEdit();
        this.loadItems();
      },
      error: () => this.error.set('Save failed. Please try again.'),
    });
  }

  remove(id: string): void {
    this.itemsService.delete(id).subscribe({
      next: () => this.loadItems(),
      error: () => this.error.set('Delete failed. Please try again.'),
    });
  }
}
