import { format, formatDistanceToNow, isValid } from "date-fns";

/**
 * Safely parses and formats a date string, handling "Infinity" and invalid dates.
 * @param dateStr The date string to format
 * @param formatStr The date-fns format string (default: "dd MMM yyyy, hh:mm a")
 * @returns Formatted date string or "N/A"
 */
export const safeFormatDate = (dateStr: string | null | undefined, formatStr: string = "dd MMM yyyy, hh:mm a"): string => {
  if (!dateStr || dateStr.toLowerCase() === "infinity" || dateStr.toLowerCase() === "-infinity") {
    return "N/A";
  }

  const date = new Date(dateStr);
  if (!isValid(date)) {
    return "N/A";
  }

  // Check for extreme dates (like year 0001 or 9999)
  const year = date.getFullYear();
  if (year <= 1 || year >= 9999) {
    return "N/A";
  }

  try {
    return format(date, formatStr);
  } catch {
    return "N/A";
  }
};

/**
 * Safely calculates distance to now, handling "Infinity" and invalid dates.
 * @param dateStr The date string
 * @returns Relative time string or "N/A"
 */
export const safeFormatDistance = (dateStr: string | null | undefined): string => {
  if (!dateStr || dateStr.toLowerCase() === "infinity" || dateStr.toLowerCase() === "-infinity") {
    return "N/A";
  }

  const date = new Date(dateStr);
  if (!isValid(date)) {
    return "N/A";
  }

  const year = date.getFullYear();
  if (year <= 1 || year >= 9999) {
    return "N/A";
  }

  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "N/A";
  }
};
