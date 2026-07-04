import { Component } from '@angular/core';
import { environment } from '../environments/environment';

type ColorToken = {
  readonly name: string;
  readonly value: string;
  readonly description: string;
};

type TypeStyle = {
  readonly name: string;
  readonly family: string;
  readonly size: string;
  readonly lineHeight: string;
};

type ComponentPreview = {
  readonly name: string;
  readonly variants: readonly string[];
  readonly usage: string;
};

type PatternPreview = {
  readonly name: string;
  readonly includes: readonly string[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly versionLabel = this.toVersionLabel(environment.appVersion);

  readonly colorTokens: readonly ColorToken[] = [
    {
      name: 'bg/paper',
      value: '#f8f7f4',
      description: 'Primary page background',
    },
    {
      name: 'bg/elevated',
      value: '#ffffff',
      description: 'Cards, badges, elevated panels',
    },
    {
      name: 'text/primary',
      value: '#1f1f1d',
      description: 'Primary text on light surfaces',
    },
    {
      name: 'text/secondary',
      value: '#625f5a',
      description: 'Body copy and supporting text',
    },
    {
      name: 'accent/green',
      value: '#27c3a2',
      description: 'Active status and environmental accent',
    },
    {
      name: 'accent/blue',
      value: '#356fd9',
      description: 'Water systems and analytical accent',
    },
  ];

  readonly spacingTokens = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const;

  readonly typeStyles: readonly TypeStyle[] = [
    {
      name: 'Display/Hero',
      family: 'Cormorant Garamond',
      size: '64px',
      lineHeight: '0.95',
    },
    {
      name: 'Heading/Card Title',
      family: 'Cormorant Garamond',
      size: '22px',
      lineHeight: '1.1',
    },
    {
      name: 'Body/Regular',
      family: 'Inter',
      size: '16px',
      lineHeight: '1.6',
    },
    {
      name: 'Button/Uppercase',
      family: 'Inter',
      size: '12px',
      lineHeight: '1',
    },
  ];

  readonly components: readonly ComponentPreview[] = [
    {
      name: 'Button',
      variants: ['Primary', 'Ghost', 'Hover', 'Focus', 'Disabled'],
      usage: 'One primary action per section, concise uppercase labels.',
    },
    {
      name: 'Badge',
      variants: ['Status / Active', 'Status / Neutral', 'Chip', 'Tag'],
      usage: 'Use for track labels, status signals, and compact metadata.',
    },
    {
      name: 'Track Card',
      variants: ['Green', 'Blue', 'Hover', 'Selected'],
      usage: 'Use when choosing or comparing research tracks.',
    },
    {
      name: 'Header',
      variants: ['Desktop', 'Mobile'],
      usage: 'Logo, center metadata, and a single right-side CTA.',
    },
  ];

  readonly patterns: readonly PatternPreview[] = [
    {
      name: 'Hero Section',
      includes: ['Status Badge', 'Display/Hero', 'Body/Large', 'Signal List'],
    },
    {
      name: 'Track Selection',
      includes: ['Section Heading', 'Track Card Grid'],
    },
    {
      name: 'Research Workspace Header',
      includes: ['Header', 'Status Badge', 'Workspace Metadata'],
    },
    {
      name: 'Panel Layout',
      includes: ['Header', 'Sidebar', 'Result Panel', 'Reasoning Panel'],
    },
  ];

  readonly exampleScreens = [
    'Landing Page',
    'Workspace Selection',
    'E-waste Dashboard',
    'Wastewater Dashboard',
    'Research Result View',
    'AI Reasoning Panel',
  ] as const;

  private toVersionLabel(version: string): string {
    if (!version || version === 'local') {
      return 'Local';
    }

    const [major, minor = '0'] = version.split('.');
    return `v${major}.${minor}`;
  }
}
