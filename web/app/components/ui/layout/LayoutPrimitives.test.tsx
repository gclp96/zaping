import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import PageContainer from './PageContainer';
import PageHeader from './PageHeader';
import Section from './Section';

afterEach(() => {
  cleanup();
});

describe('PageContainer', () => {
  it('renders children with the compatible default size', () => {
    const { container } = render(
      <PageContainer>Page content</PageContainer>,
    );

    expect(screen.getByText('Page content')).toBeTruthy();
    expect(container.firstElementChild?.className).not.toMatch(/max-w-/);
  });

  it('supports the wide size', () => {
    const { container } = render(
      <PageContainer size="wide">Wide content</PageContainer>,
    );

    expect(
      container.firstElementChild?.classList.contains('max-w-none'),
    ).toBe(true);
  });

  it('supports the narrow size', () => {
    const { container } = render(
      <PageContainer size="narrow">Narrow content</PageContainer>,
    );

    expect(
      container.firstElementChild?.classList.contains('max-w-3xl'),
    ).toBe(true);
  });

  it('preserves an additional className', () => {
    const { container } = render(
      <PageContainer className="custom-layout">Content</PageContainer>,
    );

    expect(
      container.firstElementChild?.classList.contains('custom-layout'),
    ).toBe(true);
  });

  it('uses responsive padding without rendering a main landmark', () => {
    const { container } = render(
      <PageContainer>Content</PageContainer>,
    );
    const pageContainer = container.firstElementChild;

    expect(pageContainer?.tagName).toBe('DIV');
    expect(container.querySelector('main')).toBeNull();
    expect(pageContainer?.classList.contains('px-4')).toBe(true);
    expect(pageContainer?.classList.contains('sm:px-6')).toBe(true);
    expect(pageContainer?.classList.contains('lg:px-8')).toBe(true);
  });
});

describe('PageHeader', () => {
  it('renders the title as the only h1', () => {
    render(<PageHeader title="Inventory" />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Inventory' }),
    ).toBeTruthy();
  });

  it('renders an optional description', () => {
    render(
      <PageHeader
        title="Inventory"
        description="Current stock by product."
      />,
    );

    expect(screen.getByText('Current stock by product.')).toBeTruthy();
  });

  it('renders an optional action in a responsive wrapper', () => {
    render(
      <PageHeader
        title="Inventory"
        action={<button type="button">Add item</button>}
      />,
    );

    const action = screen.getByRole('button', { name: 'Add item' });
    const actionWrapper = action.parentElement;

    expect(actionWrapper?.classList.contains('flex-wrap')).toBe(true);
    expect(actionWrapper?.classList.contains('w-full')).toBe(true);
    expect(actionWrapper?.classList.contains('md:w-auto')).toBe(true);
  });

  it('keeps title-only usage compatible', () => {
    render(<PageHeader title="Customers" />);

    expect(screen.getByText('Customers')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Section', () => {
  it('renders a title and children', () => {
    render(
      <Section title="Current stock">Section content</Section>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Current stock' }),
    ).toBeTruthy();
    expect(screen.getByText('Section content')).toBeTruthy();
  });

  it('renders a description with a title', () => {
    render(
      <Section title="Current stock" description="Available units.">
        Content
      </Section>,
    );

    expect(screen.getByText('Available units.')).toBeTruthy();
  });

  it('renders a description without a title or action', () => {
    render(<Section description="Standalone context.">Content</Section>);

    expect(screen.getByText('Standalone context.')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders an action in a responsive wrapper', () => {
    render(
      <Section
        title="Current stock"
        action={<button type="button">Export</button>}
      >
        Content
      </Section>,
    );

    const action = screen.getByRole('button', { name: 'Export' });
    const actionWrapper = action.parentElement;

    expect(actionWrapper?.classList.contains('flex-wrap')).toBe(true);
    expect(actionWrapper?.classList.contains('w-full')).toBe(true);
    expect(actionWrapper?.classList.contains('sm:w-auto')).toBe(true);
  });

  it('keeps children-only usage unframed and compatible', () => {
    const { container } = render(<Section>Plain content</Section>);
    const section = container.querySelector('section');

    expect(screen.getByText('Plain content')).toBeTruthy();
    expect(section?.classList.contains('bg-surface')).toBe(false);
    expect(section?.classList.contains('shadow')).toBe(false);
  });
});
