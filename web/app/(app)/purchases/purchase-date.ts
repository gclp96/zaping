const operationalDateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const displayDateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getOperationalDateFormatter(
  timeZone: string,
): Intl.DateTimeFormat {
  const cachedFormatter = operationalDateFormatterCache.get(timeZone);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  operationalDateFormatterCache.set(timeZone, formatter);

  return formatter;
}

function getDisplayDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cachedFormatter = displayDateFormatterCache.get(timeZone);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  displayDateFormatterCache.set(timeZone, formatter);

  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) {
    return false;
  }

  try {
    getOperationalDateFormatter(timeZone).format(new Date());
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }

    throw error;
  }
}

export function getOperationalDateKey(
  value: string,
  timeZone: string,
): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const dateParts = getOperationalDateFormatter(timeZone)
      .formatToParts(date)
      .reduce<Record<string, string>>((parts, part) => {
        if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
          parts[part.type] = part.value;
        }

        return parts;
      }, {});

    if (!dateParts.year || !dateParts.month || !dateParts.day) {
      return null;
    }

    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}

export function formatPurchaseDate(
  value: string,
  timeZone: string,
): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return getDisplayDateFormatter(timeZone).format(date);
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}
