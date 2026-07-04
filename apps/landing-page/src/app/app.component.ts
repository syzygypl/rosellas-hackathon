import { Component } from '@angular/core';
import { environment } from '../environments/environment';

type Track = {
  readonly iconSrc: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly workspaceUrl = environment.workspaceUrl;
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

  private toVersionLabel(version: string): string {
    if (!version || version === 'local') {
      return 'V1.0';
    }

    const [major, minor = '0'] = version.split('.');
    return `V${major}.${minor}`;
  }
}
