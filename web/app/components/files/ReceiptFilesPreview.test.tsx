import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReceiptFilesPreview from './ReceiptFilesPreview';
import { RECEIPT_FILE_MAX_BYTES } from './receipt-file-preview';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeFile(name: string, type: string, size?: number): File {
  const file = new File(['contenido de prueba'], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

describe('ReceiptFilesPreview — modo exclusivamente local', () => {
  it('indica que la sección es prototipo y no existe carga al servidor', () => {
    render(<ReceiptFilesPreview receiptFolio="REC-001" />);
    expect(screen.getByText(/recepción REC-001/i)).toBeTruthy();
    expect(screen.getByText(/no se guardan ni se envían/i)).toBeTruthy();
    expect(screen.getByText(/selección local \(0\/5\)/i)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /subir|guardar|enviar/i }),
    ).toBeNull();
  });

  it('permite seleccionar PDF y JPG sin leer bytes ni usar la red', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<ReceiptFilesPreview receiptFolio="REC-002" />);

    const picker = screen.getByLabelText(
      'Seleccionar archivos para vista previa local',
    );
    const files = [
      makeFile('remision.pdf', 'application/pdf'),
      makeFile('evidencia.jpg', 'image/jpeg'),
    ];

    fireEvent.change(picker, { target: { files } });

    const list = screen.getByRole('list', { name: 'Documentos seleccionados' });
    expect(within(list).getByText('remision.pdf')).toBeTruthy();
    expect(within(list).getByText('evidencia.jpg')).toBeTruthy();
    expect(screen.getByText(/selección local \(2\/5\)/i)).toBeTruthy();
    expect(screen.getByText(/ninguno se ha enviado/i)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('admite soltar un archivo y quitarlo sin persistir datos', () => {
    render(<ReceiptFilesPreview receiptFolio="REC-003" />);
    const zone = screen.getByText(/arrastra archivos aquí/i).parentElement;
    if (!zone) throw new Error('Zona de vista previa no encontrada');

    fireEvent.drop(zone, {
      dataTransfer: { files: [makeFile('acta.jpeg', 'image/jpeg')] },
    });
    expect(screen.getByText('acta.jpeg')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Quitar acta.jpeg de la vista previa',
      }),
    );
    expect(screen.queryByText('acta.jpeg')).toBeNull();
    expect(screen.getByText(/selección local \(0\/5\)/i)).toBeTruthy();
  });

  it('rechaza archivo vacío, MIME contradictorio y tamaño excesivo', () => {
    render(<ReceiptFilesPreview receiptFolio="REC-004" />);
    const picker = screen.getByLabelText(
      'Seleccionar archivos para vista previa local',
    );

    fireEvent.change(picker, {
      target: {
        files: [
          makeFile('vacio.pdf', 'application/pdf', 0),
          makeFile('disfraz.pdf', 'image/jpeg'),
          makeFile('mayor.jpg', 'image/jpeg', RECEIPT_FILE_MAX_BYTES + 1),
        ],
      },
    });
    expect(screen.getByRole('alert').textContent).toMatch(/vacio\.pdf/);
    expect(screen.getByRole('alert').textContent).toMatch(/disfraz\.pdf/);
    expect(screen.getByRole('alert').textContent).toMatch(/mayor\.jpg/);
    expect(screen.queryByRole('list', { name: 'Documentos seleccionados' })).toBeNull();
  });

  it('limita a cinco archivos y evita duplicar la misma selección', () => {
    render(<ReceiptFilesPreview receiptFolio="REC-005" />);
    const picker = screen.getByLabelText(
      'Seleccionar archivos para vista previa local',
    );
    const five = Array.from({ length: 5 }, (_, i) =>
      makeFile(`archivo-${i + 1}.pdf`, 'application/pdf'),
    );
    fireEvent.change(picker, { target: { files: five } });
    expect(screen.getByText(/selección local \(5\/5\)/i)).toBeTruthy();

    fireEvent.change(picker, {
      target: { files: [makeFile('sexto.pdf', 'application/pdf')] },
    });
    expect(screen.getByRole('alert').textContent).toMatch(/máximo 5 archivos/i);
    expect(screen.queryByText('sexto.pdf')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Quitar archivo-1.pdf de la vista previa',
      }),
    );
    fireEvent.change(picker, {
      target: { files: [makeFile('archivo-2.pdf', 'application/pdf')] },
    });
    expect(screen.getByRole('alert').textContent).toMatch(/ya está/i);
  });
});
