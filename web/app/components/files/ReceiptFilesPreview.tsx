'use client';

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  FileImage,
  FileText,
  Info,
  LockKeyhole,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react';

import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import Section from '@/app/components/ui/layout/Section';

import {
  formatReceiptFileSize,
  RECEIPT_FILE_MAX_COUNT,
  type LocalReceiptFile,
  validateReceiptFileMetadata,
} from './receipt-file-preview';

type Props = {
  receiptFolio: string;
  mode?: 'detail' | 'registration';
  onSelectionCountChange?: (count: number) => void;
};

/**
 * Design-only local preview, deliberately with NO API/R2/network integration.
 * Only file name, size and category are retained in React state.
 * No file bytes, object URLs, persistence or scan claims are created.
 */
export default function ReceiptFilesPreview({
  receiptFolio,
  mode = 'detail',
  onSelectionCountChange,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<LocalReceiptFile[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function prepareFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;

    const preview = [...files];
    const errors: string[] = [];
    let added = 0;

    for (const file of Array.from(selected)) {
      const result = validateReceiptFileMetadata(file);
      if (!result.ok) {
        errors.push(`${file.name || 'Archivo'}: ${result.reason}`);
        continue;
      }

      if (
        preview.some(
          (item) => item.name === file.name && item.sizeBytes === file.size,
        )
      ) {
        errors.push(`${file.name}: ya está en la vista previa.`);
        continue;
      }

      if (preview.length >= RECEIPT_FILE_MAX_COUNT) {
        errors.push(`Máximo ${RECEIPT_FILE_MAX_COUNT} archivos en la vista previa.`);
        break;
      }

      // Retain metadata only. Never store File/Blob content or read its bytes.
      preview.push({
        id: ++nextId.current,
        name: file.name,
        sizeBytes: file.size,
        category: result.category,
      });
      added += 1;
    }

    setFiles(preview);
    onSelectionCountChange?.(preview.length);
    setError(errors.join(' '));
    setMessage(
      added > 0
        ? `${added} archivo${added === 1 ? '' : 's'} agregado${added === 1 ? '' : 's'} a la vista previa local. Ninguno se ha enviado.`
        : '',
    );
  }

  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    prepareFiles(event.target.files);
    // Allow choosing the same filename again after it is removed.
    event.target.value = '';
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    prepareFiles(event.dataTransfer.files);
  }

  function clearSelection() {
    setFiles([]);
    onSelectionCountChange?.(0);
    setError('');
    setMessage('Selección local limpiada. No se había enviado ningún archivo.');
  }

  function removeFile(id: number) {
    const remaining = files.filter((file) => file.id !== id);
    setFiles(remaining);
    onSelectionCountChange?.(remaining.length);
    setError('');
    setMessage('Archivo quitado de la vista previa. No había sido enviado.');
  }

  return (
    <div
      className={
        mode === 'registration'
          ? 'rounded-xl border border-border bg-surface p-3 sm:p-4'
          : 'rounded-xl border border-border bg-surface p-4 sm:p-6'
      }
    >
      <Section
        title={
          mode === 'registration'
            ? 'Adjuntos de la recepción'
            : 'Documentos adjuntos'
        }
        description={
          mode === 'registration'
            ? `Comprobantes o fotografías de la orden ${receiptFolio}.`
            : `Vista previa de documentos para la recepción ${receiptFolio}.`
        }
        action={<Badge color="gray">Prototipo · Sin conexión</Badge>}
      >
        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
        >
          <Info aria-hidden="true" size={19} className="mt-0.5 shrink-0" />
          <p>
            Esta sección está en desarrollo. Los archivos seleccionados
            <strong> no se guardan ni se envían</strong> a Zaping, y la
            selección desaparecerá al salir o recargar la página.
            {mode === 'registration' ? (
              <>
                {' '}No podrás registrar esta recepción mientras haya
                archivos seleccionados. Quita o limpia la vista previa
                para continuar sin adjuntos.
              </>
            ) : null}
          </p>
        </div>

        <div
          role="group"
          aria-label="Área de selección local de archivos"
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed px-4 text-center transition-colors sm:px-6 ${
            mode === 'registration' ? 'py-4' : 'py-8'
          } ${
            isDragging
              ? 'border-blue-600 bg-blue-50'
              : 'border-border-strong bg-surface-subtle'
          }`}
        >
          <Upload
            aria-hidden="true"
            size={30}
            className="mx-auto text-blue-700"
          />
          <p className="mt-3 font-semibold text-text">
            Arrastra archivos aquí o selecciónalos
          </p>
          <p className="mt-1 text-sm text-text-muted">
            PDF, JPG o JPEG · Hasta 10 MiB cada uno · Máximo 5 archivos
          </p>

          <input
            ref={inputRef}
            id={inputId}
            aria-label="Seleccionar archivos para vista previa local"
            type="file"
            accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
            multiple
            tabIndex={-1}
            className="sr-only"
            onChange={onChoose}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip aria-hidden="true" size={16} />
            Seleccionar archivos
          </Button>
          <p className="mt-3 text-xs text-text-muted">
            La selección valida únicamente nombre, tipo y tamaño declarados por
            el navegador. No certifica el contenido ni su seguridad.
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-text-secondary">
            {message}
          </p>
        ) : null}

        <div className="space-y-3" aria-label="Archivos en vista previa local">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-text">
              Selección local ({files.length}/{RECEIPT_FILE_MAX_COUNT})
            </h3>
            <div className="flex items-center gap-2">
              <Badge color="gray">No enviados</Badge>
              {files.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  <Trash2 aria-hidden="true" size={15} />
                  Limpiar selección
                </Button>
              ) : null}
            </div>
          </div>

          {files.length === 0 ? (
            <div className="rounded-lg border border-border p-4 text-sm text-text-muted">
              {mode === 'registration'
                ? 'No hay archivos seleccionados para esta recepción.'
                : 'No hay documentos seleccionados. Todavía no se ha conectado el listado de documentos almacenados.'}
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Documentos seleccionados">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-nowrap"
                >
                  <span className="shrink-0 text-blue-700">
                    {file.category === 'PDF' ? (
                      <FileText aria-hidden="true" size={22} />
                    ) : (
                      <FileImage aria-hidden="true" size={22} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold text-text">
                      {file.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {file.category} · {formatReceiptFileSize(file.sizeBytes)}
                      {' · '}Solo vista previa
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                    <Badge color="gray">Sin guardar</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Quitar ${file.name} de la vista previa`}
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 aria-hidden="true" size={15} />
                      Quitar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-surface-subtle p-3 text-sm text-text-muted">
          <LockKeyhole aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
          <p>
            La carga, el análisis antimalware, la consulta y la descarga
            permanecerán deshabilitados hasta completar la integración segura
            con Zaping Files y Cloudflare R2.
          </p>
        </div>
      </Section>
    </div>
  );
}
