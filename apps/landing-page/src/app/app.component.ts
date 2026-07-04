import { Component } from '@angular/core';
import { environment } from '../environments/environment';

type Track = {
  readonly iconSrc: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
};

type InvestorSignal = {
  readonly value: string;
  readonly label: string;
  readonly description: string;
};

type AppFeature = {
  readonly title: string;
  readonly description: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly workspaceUrl = environment.workspaceUrl;
  readonly isInvestorsPage = this.currentPath() === '/investors';
  readonly currentYear = new Date().getFullYear();
  readonly versionLabel = this.toVersionLabel(environment.appVersion);

  readonly platformSignals = [
    'Synthesizes scientific literature',
    'Real-time AI reasoning',
    'Global regulatory coverage',
  ] as const;

  readonly tracks: readonly Track[] = [
    {
      iconSrc: 'assets/ewaste-icon.svg',
      label: 'Track I',
      title: 'E-waste Intelligence',
      description:
        'Analyzes material composition, regional regulatory frameworks, and circular economy pathways, surfacing actionable intelligence for policy teams, researchers, and recovery operators.',
      tags: ['Electronics', 'Recycling', 'Policy', 'Circular Economy'],
    },
    {
      iconSrc: 'assets/water-icon.svg',
      label: 'Track II',
      title: 'Wastewater Systems',
      description:
        'Synthesizes scientific literature and field data to support engineers, municipalities, and environmental scientists navigating complex water quality and treatment challenges.',
      tags: ['Water Quality', 'Treatment', 'Infrastructure', 'Science'],
    },
  ];

  readonly investorSignals: readonly InvestorSignal[] = [
    {
      value: 'Hybrid',
      label: 'Defensible AI',
      description:
        'LLM chat handles ambiguity and explanation while deterministic TRIZ tools preserve structured reasoning.',
    },
    {
      value: 'Grounded',
      label: 'Technical trust',
      description:
        'Every solution is backed by parameter search, contradiction matrix lookup, inventive principles, and a visible reasoning trail.',
    },
    {
      value: 'Reusable',
      label: 'Decision assets',
      description:
        'Each run produces solution cards with next steps, technical details, and a reasoning trail teams can revisit.',
    },
  ];

  readonly appFeatures: readonly AppFeature[] = [
    {
      title: 'Conversational intake',
      description:
        'The chat asks focused clarifying questions until it understands the system, the improvement goal, and the constraint.',
    },
    {
      title: 'TRIZ-grounded solving',
      description:
        'The backend calls dedicated TRIZ tools for engineering parameters, contradiction matrix lookup, and inventive principles.',
    },
    {
      title: 'Solution side panel',
      description:
        'Each solved run becomes a card with a plain-language contradiction, directions, next steps, full report, and technical details.',
    },
    {
      title: 'Multi-turn refinement',
      description:
        'Users can continue the conversation to add context, compare directions, or sharpen the problem without restarting.',
    },
    {
      title: 'Dual engine architecture',
      description:
        'An LLM agent powers the rich experience when configured, while a deterministic TRIZ pipeline keeps the app useful as fallback.',
    },
    {
      title: 'Traceable sessions',
      description:
        'Copyable session ids and optional Langfuse tracing connect chat turns, model calls, MCP tool calls, and final cards.',
    },
  ];

  private currentPath(): string {
    const path = window.location.pathname.replace(/\/$/, '');
    return path || '/';
  }

  private toVersionLabel(version: string): string {
    if (!version || version === 'local') {
      return 'V1.0';
    }

    const [major, minor = '0'] = version.split('.');
    return `V${major}.${minor}`;
  }
}
