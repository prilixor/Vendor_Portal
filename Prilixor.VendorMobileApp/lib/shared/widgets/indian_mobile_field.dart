import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme.dart';
import '../../core/utils/indian_mobile_phone.dart';
import 'required_field_ux.dart';

/// Indian mobile input with a fixed +91 chip (matches Vendor Web `IndianMobileInput`).
/// Controller holds only the 10-digit national number.
class IndianMobileField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool required;
  final String? errorText;
  final String? helperText;
  final ValueChanged<String>? onChanged;
  final TextInputAction? textInputAction;
  final FocusNode? focusNode;
  final bool enabled;

  const IndianMobileField({
    super.key,
    required this.controller,
    required this.label,
    this.required = false,
    this.errorText,
    this.helperText = '10-digit Indian mobile starting with 6-9',
    this.onChanged,
    this.textInputAction,
    this.focusNode,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final hasError = errorText != null && errorText!.isNotEmpty;
    final borderColor = hasError
        ? kFieldErrorColor
        : colors.border.withValues(alpha: 0.85);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RequiredLabel(label, required: required),
        const SizedBox(height: 8),
        AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor, width: hasError ? 1.4 : 1),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: const BorderRadius.horizontal(
                    left: Radius.circular(11),
                  ),
                  border: Border(
                    right: BorderSide(color: colors.border.withValues(alpha: 0.7)),
                  ),
                ),
                child: Text(
                  '+91',
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              Expanded(
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  enabled: enabled,
                  keyboardType: TextInputType.phone,
                  textInputAction: textInputAction,
                  inputFormatters: const [_IndianMobileInputFormatter()],
                  style: TextStyle(color: colors.textPrimary, fontSize: 15),
                  onChanged: onChanged,
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    hintText: '9876543210',
                    hintStyle: TextStyle(
                      color: colors.textMuted.withValues(alpha: 0.7),
                      fontSize: 15,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 16,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 6),
          Text(
            errorText!,
            style: const TextStyle(color: kFieldErrorColor, fontSize: 12),
          ),
        ] else if (helperText != null && helperText!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            helperText!,
            style: TextStyle(color: colors.textMuted, fontSize: 11),
          ),
        ],
      ],
    );
  }
}

class _IndianMobileInputFormatter extends TextInputFormatter {
  const _IndianMobileInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final masked = IndianMobilePhone.maskInput(newValue.text);
    return TextEditingValue(
      text: masked,
      selection: TextSelection.collapsed(offset: masked.length),
    );
  }
}
