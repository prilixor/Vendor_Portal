import 'package:flutter/material.dart';

import '../../core/theme.dart';

const Color kRequiredStarColor = Color(0xFFF87171);
const Color kFieldErrorColor = Color(0xFFF87171);

class RequiredFieldsNote extends StatelessWidget {
  final EdgeInsetsGeometry padding;

  const RequiredFieldsNote({
    super.key,
    this.padding = const EdgeInsets.only(bottom: 12),
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: padding,
      child: Text.rich(
        TextSpan(
          style: TextStyle(color: colors.textMuted, fontSize: 12),
          children: const [
            TextSpan(text: 'Fields marked '),
            TextSpan(
              text: '*',
              style: TextStyle(
                color: kRequiredStarColor,
                fontWeight: FontWeight.bold,
              ),
            ),
            TextSpan(text: ' are required'),
          ],
        ),
      ),
    );
  }
}

class RequiredLabel extends StatelessWidget {
  final String text;
  final bool required;
  final TextStyle? style;

  const RequiredLabel(
    this.text, {
    super.key,
    this.required = false,
    this.style,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final base = style ??
        TextStyle(
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        );
    if (!required) return Text(text, style: base);
    return Text.rich(
      TextSpan(
        style: base,
        children: [
          TextSpan(text: text),
          const TextSpan(
            text: ' *',
            style: TextStyle(
              color: kRequiredStarColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

/// Inline field error under an input.
class FieldErrorText extends StatelessWidget {
  final String? message;

  const FieldErrorText(this.message, {super.key});

  @override
  Widget build(BuildContext context) {
    if (message == null || message!.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Text(
        message!,
        style: const TextStyle(color: kFieldErrorColor, fontSize: 12),
      ),
    );
  }
}

void showRequiredFieldsBlocked(
  BuildContext context, {
  String message = 'Please fill in the required fields.',
}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), backgroundColor: Colors.redAccent),
  );
}

InputDecoration requiredInputDecoration(
  BuildContext context, {
  required String label,
  bool required = false,
  String? errorText,
  String? hintText,
  IconData? prefixIcon,
  Widget? suffixIcon,
  Color? fillColor,
  bool filled = true,
}) {
  final colors = context.appColors;
  final hasError = errorText != null && errorText.isNotEmpty;
  final borderRadius = BorderRadius.circular(12);
  return InputDecoration(
    label: RequiredLabel(label, required: required),
    floatingLabelBehavior: FloatingLabelBehavior.auto,
    hintText: hintText,
    hintStyle: TextStyle(color: colors.textMuted),
    errorText: hasError ? errorText : null,
    errorStyle: const TextStyle(color: kFieldErrorColor, fontSize: 12),
    prefixIcon: prefixIcon != null
        ? Icon(prefixIcon, color: colors.textMuted)
        : null,
    suffixIcon: suffixIcon,
    filled: filled,
    fillColor: fillColor ?? colors.surface,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: borderRadius,
      borderSide: BorderSide(color: colors.border.withValues(alpha: 0.5)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: borderRadius,
      borderSide: BorderSide(
        color: hasError ? kFieldErrorColor : colors.border.withValues(alpha: 0.85),
      ),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: borderRadius,
      borderSide: BorderSide(
        color: hasError ? kFieldErrorColor : AppTheme.accent,
        width: 2,
      ),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: borderRadius,
      borderSide: const BorderSide(color: kFieldErrorColor),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderRadius: borderRadius,
      borderSide: const BorderSide(color: kFieldErrorColor, width: 2),
    ),
  );
}

String? requiredMessage(
  String? value, {
  String message = 'This field is required',
}) {
  if (value == null || value.trim().isEmpty) return message;
  return null;
}
