import { describe, it, expect } from 'vitest';
import { PersonalizationService } from '../../src/services/personalization.service';

describe('PersonalizationService', () => {
  it('replaces all supported variables correctly', () => {
    const text = 'Hi {{firstName}} {{lastName}}, welcome to {{company}} as {{jobTitle}}! Your email is {{email}}.';
    const context = {
      firstName: 'Jane',
      lastName: 'Doe',
      company: 'Acme Corp',
      jobTitle: 'VP of Growth',
      email: 'jane@acme.com',
    };

    const result = PersonalizationService.render(text, context);
    expect(result.rendered).toBe('Hi Jane Doe, welcome to Acme Corp as VP of Growth! Your email is jane@acme.com.');
    expect(result.usedVariables).toEqual(expect.arrayContaining(['firstName', 'lastName', 'company', 'jobTitle', 'email']));
    expect(result.missingVariables).toHaveLength(0);
  });

  it('handles spaces inside variable brackets', () => {
    const text = 'Hello {{ firstName }} from {{   company  }}!';
    const context = { firstName: 'Alice', company: 'Wonderland Inc' };
    const result = PersonalizationService.render(text, context);
    expect(result.rendered).toBe('Hello Alice from Wonderland Inc!');
  });

  it('safely handles missing fields with default fallback (empty string)', () => {
    const text = 'Hi {{firstName}}, are you still at {{company}}?';
    const context = { firstName: 'Bob' };
    const result = PersonalizationService.render(text, context);
    expect(result.rendered).toBe('Hi Bob, are you still at ?');
    expect(result.missingVariables).toEqual(['company']);
  });

  it('safely handles custom fallback values', () => {
    const text = 'Hi {{firstName}}, are you still at {{company}}?';
    const context = { firstName: 'Bob' };
    const result = PersonalizationService.render(text, context, { fallbackValue: '[N/A]' });
    expect(result.rendered).toBe('Hi Bob, are you still at [N/A]?');
  });

  it('ignores unsupported variables and does not execute arbitrary code', () => {
    const text = 'Hello {{process.exit()}} and {{isAdmin}} and {{1 + 1}}!';
    const context = { firstName: 'Eve' };
    const result = PersonalizationService.render(text, context);
    expect(result.rendered).toBe('Hello {{process.exit()}} and {{isAdmin}} and {{1 + 1}}!');
    expect(result.usedVariables).toHaveLength(0);
  });

  it('renders both subject and body in renderEmail', () => {
    const subject = 'Quick question for {{firstName}}';
    const body = 'Hi {{firstName}},\nSaw your work at {{company}}.';
    const context = { firstName: 'Sarah', company: 'Stripe' };

    const result = PersonalizationService.renderEmail(subject, body, context);
    expect(result.subject).toBe('Quick question for Sarah');
    expect(result.body).toBe('Hi Sarah,\nSaw your work at Stripe.');
    expect(result.usedVariables).toEqual(expect.arrayContaining(['firstName', 'company']));
  });

  it('handles empty or null template text safely', () => {
    const result = PersonalizationService.render('', { firstName: 'Test' });
    expect(result.rendered).toBe('');
    expect(result.usedVariables).toHaveLength(0);
  });
});
