import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { api } from '@/services/api';
import { clearAuthenticatedSessionCache } from '@/app/auth-session';

import CategoriesPage from './page';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/errors', () => ({
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

const activeCategory = {
  id: 'category-active',
  name: 'Consumibles',
  description: 'Material de uso frecuente',
  isActive: true,
};

const inactiveCategory = {
  id: 'category-inactive',
  name: 'Equipo legado',
  description: null,
  isActive: false,
};

const categories = [activeCategory, inactiveCategory];

function authSessionResponse(
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'WAREHOUSE' = 'ADMIN',
) {
  return {
    data: {
      id: 'user-1',
      companyId: 'company-1',
      email: 'admin@test.test',
      firstName: 'Admin',
      lastName: 'Test',
      role,
      companyTimezone: 'America/Hermosillo',
    },
  } as never;
}

function configureApiMocks(
  categoryData = categories,
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'WAREHOUSE' = 'ADMIN',
) {
  vi.mocked(api.get).mockImplementation(async (url) =>
    String(url) === '/auth/me'
      ? authSessionResponse(role)
      : ({ data: categoryData } as never),
  );
  vi.mocked(api.post).mockResolvedValue({ data: activeCategory } as never);
  vi.mocked(api.patch).mockResolvedValue({ data: activeCategory } as never);
  vi.mocked(api.delete).mockResolvedValue({ data: {} } as never);
}

async function renderCategoriesPage() {
  render(<CategoriesPage />);
  await screen.findByText(activeCategory.name);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let alertSpy: ReturnType<typeof vi.spyOn>;

describe('CategoriesPage', () => {
  beforeEach(() => {
    clearAuthenticatedSessionCache();
    vi.clearAllMocks();
    configureApiMocks();
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    alertSpy = vi
      .spyOn(window, 'alert')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('uses the shared page structure and renders the current category content', async () => {
    const { container } = render(<CategoriesPage />);

    expect(screen.getByText('Cargando categorías...')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Categorías' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.firstElementChild?.classList.contains('mx-auto')).toBe(
      true,
    );
    expect(container.firstElementChild?.classList.contains('space-y-8')).toBe(
      true,
    );

    expect(await screen.findByText(activeCategory.name)).toBeTruthy();
    expect(screen.getByText('Activa')).toBeTruthy();
    expect(screen.getByText(inactiveCategory.name)).toBeTruthy();
    expect(screen.getByText('Inactiva')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeTruthy();
  });

  it.each(['SALES', 'WAREHOUSE'] as const)(
    'mantiene la lectura de categorías y oculta las mutaciones para %s',
    async (role) => {
      clearAuthenticatedSessionCache();
      configureApiMocks(categories, role);

      render(<CategoriesPage />);

      await screen.findByText(activeCategory.name);
      expect(screen.queryByRole('button', { name: 'Nueva Categoría' })).toBeNull();
      expect(
        screen
          .getByText(activeCategory.name)
          .closest('tr')
          ?.querySelector('button'),
      ).toBeNull();
    },
  );

  it('renders the existing empty state when no categories are registered', async () => {
    configureApiMocks([]);

    render(<CategoriesPage />);

    expect(
      await screen.findByText('No hay categorías registradas'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Crea la primera categoría para organizar tus productos.',
      ),
    ).toBeTruthy();
  });

  it('preserves the existing fallback when loading categories fails', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/auth/me') {
        return authSessionResponse();
      }

      throw new Error('Error de red');
    });

    render(<CategoriesPage />);

    expect(
      await screen.findByText('No hay categorías registradas'),
    ).toBeTruthy();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('sorts categories by name with the shared stable sort utility', async () => {
    const user = userEvent.setup();

    await renderCategoriesPage();
    await user.click(screen.getByRole('button', { name: 'Nombre' }));
    await user.click(screen.getByRole('button', { name: 'Nombre' }));

    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText(inactiveCategory.name)).toBeTruthy();
    expect(within(rows[2]).getByText(activeCategory.name)).toBeTruthy();
  });

  it('creates a category with the existing payload and refreshes the list', async () => {
    const user = userEvent.setup();
    const newCategory = {
      id: 'category-new',
      name: 'Implantes',
      description: 'Material implantable',
      isActive: false,
    };
    let categoryRequestCount = 0;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/auth/me') {
        return authSessionResponse();
      }

      categoryRequestCount += 1;
      return {
        data: categoryRequestCount === 1
          ? categories
          : [...categories, newCategory],
      } as never;
    });
    vi.mocked(api.post).mockResolvedValue({ data: newCategory } as never);

    await renderCategoriesPage();
    await user.click(
      screen.getByRole('button', { name: 'Nueva Categoría' }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), {
      target: { value: 'Implantes' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Descripción' }), {
      target: { value: 'Material implantable' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Activa' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/categories', {
        name: 'Implantes',
        description: 'Material implantable',
        isActive: false,
      });
    });
    expect(await screen.findByText(newCategory.name)).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Nueva Categoría' }),
    ).toBeNull();
  });

  it('edits a category through the existing action and payload', async () => {
    const user = userEvent.setup();
    const updatedCategory = {
      ...activeCategory,
      name: 'Consumibles clínicos',
    };
    let categoryRequestCount = 0;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/auth/me') {
        return authSessionResponse();
      }

      categoryRequestCount += 1;
      return {
        data: categoryRequestCount === 1
          ? categories
          : [updatedCategory, inactiveCategory],
      } as never;
    });
    vi.mocked(api.patch).mockResolvedValue({ data: updatedCategory } as never);

    await renderCategoriesPage();
    const categoryRow = screen.getByText(activeCategory.name).closest('tr');
    expect(categoryRow).toBeTruthy();
    await user.click(
      within(categoryRow as HTMLTableRowElement).getByRole('button', {
        name: `Acciones de ${activeCategory.name}`,
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    const nameInput = screen.getByRole('textbox', { name: 'Nombre' });
    fireEvent.change(nameInput, {
      target: { value: updatedCategory.name },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(`/categories/${activeCategory.id}`, {
        name: updatedCategory.name,
        description: activeCategory.description,
        isActive: true,
      });
    });
    expect(await screen.findByText(updatedCategory.name)).toBeTruthy();
  });

  it('deletes a category through the existing confirmation flow', async () => {
    const user = userEvent.setup();
    let categoryRequestCount = 0;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === '/auth/me') {
        return authSessionResponse();
      }

      categoryRequestCount += 1;
      return {
        data: categoryRequestCount === 1 ? categories : [inactiveCategory],
      } as never;
    });

    await renderCategoriesPage();
    const categoryRow = screen.getByText(activeCategory.name).closest('tr');
    expect(categoryRow).toBeTruthy();
    await user.click(
      within(categoryRow as HTMLTableRowElement).getByRole('button', {
        name: `Acciones de ${activeCategory.name}`,
      }),
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Acción destructiva: Eliminar',
      }),
    );

    const dialogHeading = screen.getByRole('heading', {
      name: 'Eliminar categoría',
    });
    const dialog = dialogHeading.parentElement?.parentElement;
    expect(dialog).toBeTruthy();
    await user.click(
      within(dialog as HTMLElement).getByRole('button', { name: 'Eliminar' }),
    );

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        `/categories/${activeCategory.id}`,
      );
    });
    await waitFor(() => {
      expect(screen.queryByText(activeCategory.name)).toBeNull();
    });
  });
});
