import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SolveResult, TrizParameter } from './models/solve.model';
import { SolverService } from './services/solver.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly solverService = inject(SolverService);

  problem = '';
  result = signal<SolveResult | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  solve(): void {
    const problem = this.problem.trim();
    if (!problem) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.solverService.solve({ problem }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Solver request failed. Check whether the backend and TRIZ MCP server are running.');
        this.loading.set(false);
      },
    });
  }

  reset(): void {
    this.problem = '';
    this.result.set(null);
    this.error.set(null);
  }

  parameterName(parameter: TrizParameter | null): string {
    return parameter ? `[${parameter.id}] ${parameter.name}` : 'Not detected';
  }
}
