import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../../App';

describe('App', () => {
  it('renders the login shell when the session is anonymous', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/session') {
        return Response.json({
          authenticated: false,
          viewer: null,
        });
      }

      return Response.json({ error: 'unexpected request' }, { status: 500 });
    }));

    render(<App />);

    expect(await screen.findByText('Sign in with GitHub to start editing.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'EDU-PUBLISH-CMS' })).toBeInTheDocument();
  });
});
